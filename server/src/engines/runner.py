#!/usr/bin/env python3
"""Resource-limited process runner used by the coding evaluation engine.

Usage:
    runner.py --meta META_PATH --timeout-ms N [--memory-kb N] [--cpu-seconds N]
              [--output-bytes N] -- COMMAND [ARGS...]

Reads the child's stdin from our own stdin, forwards stdout/stderr, and writes a
JSON object to META_PATH describing the run:

    {"exit_code": 0, "wall_ms": 12, "max_rss_kb": 8192, "timed_out": false,
     "signal": null}

Limits are applied with setrlimit in the child before exec, so a runaway program
is stopped by the kernel rather than trusted to behave. See the engine's module
docstring for what this does and does not isolate.
"""
import argparse
import json
import os
import resource
import signal
import subprocess
import sys
import time


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--meta", required=True)
    parser.add_argument("--timeout-ms", type=int, required=True)
    parser.add_argument("--memory-kb", type=int, default=0)
    parser.add_argument("--cpu-seconds", type=int, default=0)
    parser.add_argument("--output-bytes", type=int, default=1 << 22)
    parser.add_argument("command", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    if args.command and args.command[0] == "--":
        args.command = args.command[1:]
    if not args.command:
        parser.error("no command given")
    return args


def make_preexec(memory_kb: int, cpu_seconds: int, output_bytes: int):
    def preexec() -> None:
        # New process group so a timeout kills the whole tree, not just the head.
        os.setsid()
        if cpu_seconds > 0:
            resource.setrlimit(resource.RLIMIT_CPU, (cpu_seconds, cpu_seconds + 1))
        if output_bytes > 0:
            resource.setrlimit(resource.RLIMIT_FSIZE, (output_bytes, output_bytes))
        # Cap subprocess creation; a fork bomb should fail rather than spread.
        try:
            resource.setrlimit(resource.RLIMIT_NPROC, (256, 256))
        except (ValueError, OSError):
            pass
        resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
        if memory_kb > 0:
            limit = memory_kb * 1024
            try:
                resource.setrlimit(resource.RLIMIT_AS, (limit, limit))
            except (ValueError, OSError):
                pass

    return preexec


def main() -> int:
    args = parse_args()
    stdin_data = sys.stdin.buffer.read()

    started = time.monotonic()
    timed_out = False
    term_signal = None

    process = subprocess.Popen(
        args.command,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        preexec_fn=make_preexec(args.memory_kb, args.cpu_seconds, args.output_bytes),
    )

    try:
        stdout, stderr = process.communicate(input=stdin_data, timeout=args.timeout_ms / 1000)
    except subprocess.TimeoutExpired:
        timed_out = True
        try:
            os.killpg(os.getpgid(process.pid), signal.SIGKILL)
        except (ProcessLookupError, PermissionError):
            process.kill()
        stdout, stderr = process.communicate()

    wall_ms = int((time.monotonic() - started) * 1000)
    exit_code = process.returncode
    if exit_code is not None and exit_code < 0:
        term_signal = -exit_code

    # ru_maxrss covers all reaped children of this runner, which is exactly the
    # one program we launched.
    usage = resource.getrusage(resource.RUSAGE_CHILDREN)
    max_rss_kb = int(usage.ru_maxrss)  # kilobytes on Linux

    limit = args.output_bytes
    sys.stdout.buffer.write(stdout[:limit])
    sys.stdout.buffer.flush()
    sys.stderr.buffer.write(stderr[:limit])
    sys.stderr.buffer.flush()

    with open(args.meta, "w", encoding="utf-8") as handle:
        json.dump(
            {
                "exit_code": exit_code,
                "wall_ms": wall_ms,
                "max_rss_kb": max_rss_kb,
                "timed_out": timed_out,
                "signal": term_signal,
                "stdout_truncated": len(stdout) > limit,
                "stderr_truncated": len(stderr) > limit,
            },
            handle,
        )

    return 0


if __name__ == "__main__":
    sys.exit(main())
