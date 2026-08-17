import type { CodingSeed } from './types.js';

/**
 * Coding problems. Every problem reads from stdin and writes to stdout so the
 * evaluation engine stays language-agnostic.
 *
 * `referencePython` is executed against every sample and hidden case by
 * `npm run verify:questions`, so the expected outputs below are machine-checked.
 */

const STARTERS = {
  python: '# Read from standard input and print the answer.\nimport sys\n\ndef main():\n    data = sys.stdin.read().split()\n    # your code here\n\nmain()\n',
  javascript:
    "// Read from standard input and print the answer. (CommonJS)\nconst data = require('fs').readFileSync(0, 'utf8').split(/\\s+/).filter(Boolean);\n// your code here\n",
  c: '#include <stdio.h>\n\nint main(void) {\n    /* your code here */\n    return 0;\n}\n',
  cpp: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n    /* your code here */\n    return 0;\n}\n',
  java:
    'import java.util.*;\nimport java.io.*;\n\npublic class Main {\n    public static void main(String[] args) throws IOException {\n        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\n        // your code here\n    }\n}\n',
} as const;

export const CODING_PROBLEMS: CodingSeed[] = [
  {
    id: 'COD-0001',
    title: 'Sum of Digits',
    body:
      'Given a non-negative integer N, print the sum of its decimal digits.\n\nThis is a warm-up problem that checks you can read input and produce exactly the required output format.',
    topic: 'strings',
    difficulty: 'easy',
    expectedSeconds: 300,
    inputFormat: 'A single line containing the integer N.',
    outputFormat: 'A single line containing the sum of the digits of N.',
    constraints: '0 ≤ N ≤ 10^18',
    starterCode: STARTERS,
    samples: [
      { input: '12345\n', expected: '15', explanation: '1 + 2 + 3 + 4 + 5 = 15.' },
      { input: '9\n', expected: '9', explanation: 'A single-digit number is its own digit sum.' },
    ],
    hidden: [
      { input: '0\n', expected: '0' },
      { input: '1000000\n', expected: '1' },
      { input: '999999999999999999\n', expected: '162' },
      { input: '4030201\n', expected: '10' },
    ],
    referencePython: 'import sys\nn = sys.stdin.read().strip()\nprint(sum(int(c) for c in n))\n',
    editorial:
      'Read the number as a string and add the numeric value of each character. Treating it as a string avoids 64-bit overflow entirely, which matters at the upper constraint — in C, N = 10^18 does not fit in a 32-bit int.',
    concept: 'Reading large integers as strings sidesteps overflow in languages with fixed-width integers.',
    hint: 'You never need to do arithmetic on N itself.',
  },

  {
    id: 'COD-0002',
    title: 'Second Largest Element',
    body:
      'Given an array of N integers, print the second largest **distinct** value. If no such value exists, print -1.',
    topic: 'arrays',
    difficulty: 'easy',
    expectedSeconds: 480,
    frequentlyAsked: true,
    companies: ['tcs', 'infosys', 'wipro', 'capgemini', 'accenture', 'cognizant'],
    inputFormat: 'The first line contains N. The second line contains N space-separated integers.',
    outputFormat: 'The second largest distinct value, or -1 if it does not exist.',
    constraints: '1 ≤ N ≤ 10^5, −10^9 ≤ A[i] ≤ 10^9',
    starterCode: STARTERS,
    samples: [
      { input: '5\n10 5 8 20 3\n', expected: '10', explanation: 'The largest is 20 and the next distinct value is 10.' },
      { input: '4\n7 7 7 7\n', expected: '-1', explanation: 'All values are identical, so there is no second distinct value.' },
    ],
    hidden: [
      { input: '1\n42\n', expected: '-1' },
      { input: '2\n-5 -9\n', expected: '-9' },
      { input: '6\n3 3 2 2 1 1\n', expected: '2' },
      { input: '7\n1000000000 999999999 1000000000 5 5 5 -1000000000\n', expected: '999999999' },
    ],
    referencePython:
      'import sys\ndata = sys.stdin.read().split()\nn = int(data[0])\narr = list(map(int, data[1:1 + n]))\nuniq = sorted(set(arr), reverse=True)\nprint(uniq[1] if len(uniq) > 1 else -1)\n',
    editorial:
      'One pass suffices: track the largest and the largest value strictly below it. Sorting the distinct values is O(n log n) and also fine at these limits. The trap is duplicates — "second largest" almost always means second largest *distinct* value, so clarify this in an interview before coding.',
    hint: 'Keep two running variables and only update the second when the candidate is strictly smaller than the first.',
  },

  {
    id: 'COD-0003',
    title: 'Reverse the Words',
    body:
      'Given a line of text, print the words in reverse order, separated by single spaces. Words are separated by one or more spaces in the input.',
    topic: 'strings',
    subtopic: 'string-manipulation',
    difficulty: 'easy',
    expectedSeconds: 420,
    companies: ['tcs', 'wipro', 'accenture', 'capgemini'],
    inputFormat: 'A single line of text.',
    outputFormat: 'The words in reverse order, separated by single spaces.',
    constraints: 'The line contains at most 10^5 characters and at least one word.',
    starterCode: STARTERS,
    samples: [
      { input: 'the sky is blue\n', expected: 'blue is sky the' },
      { input: '  hello   world  \n', expected: 'world hello', explanation: 'Extra spaces are collapsed in the output.' },
    ],
    hidden: [
      { input: 'single\n', expected: 'single' },
      { input: 'a b c d e\n', expected: 'e d c b a' },
      { input: 'Placement   preparation   platform\n', expected: 'platform preparation Placement' },
    ],
    referencePython: 'import sys\nprint(" ".join(reversed(sys.stdin.read().split())))\n',
    editorial:
      'Split on whitespace, reverse the resulting list, and join with single spaces. Splitting on arbitrary whitespace handles the multiple-space case for free; in C you would tokenise with strtok and push onto a stack.',
    hint: 'Do not reverse the characters — reverse the sequence of words.',
  },

  {
    id: 'COD-0004',
    title: 'Valid Anagram',
    body:
      'Given two strings S and T consisting of lowercase English letters, print "YES" if T is an anagram of S and "NO" otherwise.',
    topic: 'strings',
    subtopic: 'pattern-matching',
    difficulty: 'easy',
    expectedSeconds: 420,
    frequentlyAsked: true,
    companies: ['tcs', 'infosys', 'amazon', 'walmart'],
    inputFormat: 'Two lines: S on the first and T on the second.',
    outputFormat: 'YES or NO.',
    constraints: '1 ≤ |S|, |T| ≤ 10^5',
    starterCode: STARTERS,
    samples: [
      { input: 'listen\nsilent\n', expected: 'YES' },
      { input: 'hello\nbello\n', expected: 'NO', explanation: 'The letter counts differ: h versus b.' },
    ],
    hidden: [
      { input: 'a\na\n', expected: 'YES' },
      { input: 'ab\nabc\n', expected: 'NO' },
      { input: 'aabbcc\nbbaacc\n', expected: 'YES' },
      { input: 'anagram\nnagaram\n', expected: 'YES' },
      { input: 'rat\ncar\n', expected: 'NO' },
    ],
    referencePython:
      'import sys\nfrom collections import Counter\nlines = sys.stdin.read().split("\\n")\ns = lines[0].strip()\nt = lines[1].strip() if len(lines) > 1 else ""\nprint("YES" if Counter(s) == Counter(t) else "NO")\n',
    editorial:
      'Compare character frequencies. A fixed array of 26 counters gives O(n) time and O(1) extra space, which beats the O(n log n) sort-and-compare approach. Always check the lengths first as a fast reject.',
    concept: 'Counting is the standard replacement for sorting when you only need multiset equality.',
  },

  {
    id: 'COD-0005',
    title: 'Pair With Given Sum',
    body:
      'Given an array of N integers and a target K, determine whether two **distinct positions** hold values summing to exactly K. Print "YES" or "NO".',
    topic: 'hashing',
    difficulty: 'medium',
    expectedSeconds: 600,
    frequentlyAsked: true,
    companies: ['amazon', 'microsoft', 'walmart', 'cognizant', 'salesforce'],
    inputFormat: 'The first line contains N and K. The second line contains N space-separated integers.',
    outputFormat: 'YES or NO.',
    constraints: '1 ≤ N ≤ 10^5, −10^9 ≤ A[i], K ≤ 10^9',
    starterCode: STARTERS,
    samples: [
      { input: '5 9\n2 7 11 15 1\n', expected: 'YES', explanation: '2 + 7 = 9.' },
      { input: '4 100\n1 2 3 4\n', expected: 'NO' },
    ],
    hidden: [
      { input: '1 5\n5\n', expected: 'NO' },
      { input: '2 10\n5 5\n', expected: 'YES' },
      { input: '3 0\n-4 4 9\n', expected: 'YES' },
      { input: '5 -8\n-3 -5 -1 -2 -9\n', expected: 'YES' },
      { input: '4 8\n4 1 2 3\n', expected: 'NO' },
    ],
    referencePython:
      'import sys\ndata = sys.stdin.read().split()\nn, k = int(data[0]), int(data[1])\narr = list(map(int, data[2:2 + n]))\nseen = set()\nfound = False\nfor v in arr:\n    if k - v in seen:\n        found = True\n        break\n    seen.add(v)\nprint("YES" if found else "NO")\n',
    editorial:
      'Scan once, keeping a hash set of values already seen. For each value v, check whether K − v is present. This is O(n) time and O(n) space. Note the subtlety in the third hidden case: a single 5 with K = 10 must print NO because the two positions must be distinct — checking the complement *before* inserting the current value handles this correctly.',
    concept: 'Insert-after-check is what makes the "two distinct indices" requirement fall out naturally.',
    hint: 'Look up the complement before adding the current element to the set.',
  },

  {
    id: 'COD-0006',
    title: 'Maximum Subarray Sum',
    body:
      'Given an array of N integers, print the largest sum obtainable from any non-empty contiguous subarray.',
    topic: 'arrays',
    subtopic: 'prefix-sums',
    difficulty: 'medium',
    expectedSeconds: 660,
    frequentlyAsked: true,
    companies: ['amazon', 'microsoft', 'adobe', 'walmart', 'google'],
    inputFormat: 'The first line contains N. The second line contains N space-separated integers.',
    outputFormat: 'The maximum subarray sum.',
    constraints: '1 ≤ N ≤ 10^5, −10^4 ≤ A[i] ≤ 10^4',
    starterCode: STARTERS,
    samples: [
      { input: '9\n-2 1 -3 4 -1 2 1 -5 4\n', expected: '6', explanation: 'The subarray [4, −1, 2, 1] sums to 6.' },
      { input: '5\n-5 -2 -8 -1 -4\n', expected: '-1', explanation: 'All values are negative, so the best is the single largest element.' },
    ],
    hidden: [
      { input: '1\n-7\n', expected: '-7' },
      { input: '4\n1 2 3 4\n', expected: '10' },
      { input: '6\n5 -1 5 -1 5 -100\n', expected: '13' },
      { input: '3\n-1 -1 -1\n', expected: '-1' },
      { input: '8\n8 -19 5 -4 20 -1 4 -13\n', expected: '24' },
    ],
    referencePython:
      'import sys\ndata = sys.stdin.read().split()\nn = int(data[0])\narr = list(map(int, data[1:1 + n]))\nbest = cur = arr[0]\nfor v in arr[1:]:\n    cur = max(v, cur + v)\n    best = max(best, cur)\nprint(best)\n',
    editorial:
      "Kadane's algorithm: at each position either extend the previous subarray or start fresh at the current element, then track the running best. O(n) time, O(1) space. The classic bug is initialising `best` to 0, which breaks on all-negative input — initialise from the first element instead.",
    concept: 'This is the simplest example of a DP where the state is "best sum ending here".',
    hint: 'What is the best subarray that ends exactly at index i?',
  },

  {
    id: 'COD-0007',
    title: 'First Non-Repeating Character',
    body:
      'Given a string S of lowercase letters, print the first character that appears exactly once. If every character repeats, print "None".',
    topic: 'hashing',
    difficulty: 'easy',
    expectedSeconds: 480,
    companies: ['tcs', 'infosys', 'accenture', 'adobe'],
    inputFormat: 'A single line containing S.',
    outputFormat: 'The first non-repeating character, or None.',
    constraints: '1 ≤ |S| ≤ 10^5',
    starterCode: STARTERS,
    samples: [
      { input: 'placeprep\n', expected: 'l', explanation: 'p appears three times; l appears once and is earliest.' },
      { input: 'aabb\n', expected: 'None' },
    ],
    hidden: [
      { input: 'z\n', expected: 'z' },
      { input: 'aabbc\n', expected: 'c' },
      { input: 'abcabcd\n', expected: 'd' },
      { input: 'xxyyzzq\n', expected: 'q' },
    ],
    referencePython:
      'import sys\nfrom collections import Counter\ns = sys.stdin.read().strip()\ncounts = Counter(s)\nfor ch in s:\n    if counts[ch] == 1:\n        print(ch)\n        break\nelse:\n    print("None")\n',
    editorial:
      'Two passes: first count every character, then walk the string again and return the first with count 1. Order matters, so you must scan the original string on the second pass rather than iterating the frequency map.',
    hint: 'Count first, decide second.',
  },

  {
    id: 'COD-0008',
    title: 'Balanced Brackets',
    body:
      'Given a string containing only the characters ( ) [ ] { }, print "YES" if the brackets are correctly balanced and nested, and "NO" otherwise.',
    topic: 'stacks-queues',
    difficulty: 'medium',
    expectedSeconds: 600,
    frequentlyAsked: true,
    companies: ['amazon', 'microsoft', 'adobe', 'cognizant', 'deloitte'],
    inputFormat: 'A single line containing the bracket string.',
    outputFormat: 'YES or NO.',
    constraints: '1 ≤ |S| ≤ 10^5',
    starterCode: STARTERS,
    samples: [
      { input: '{[()]}\n', expected: 'YES' },
      { input: '{[(])}\n', expected: 'NO', explanation: 'The ] closes a ( , so the nesting is wrong.' },
    ],
    hidden: [
      { input: '(\n', expected: 'NO' },
      { input: ')(\n', expected: 'NO' },
      { input: '()[]{}\n', expected: 'YES' },
      { input: '((((()))))\n', expected: 'YES' },
      { input: '{[}\n', expected: 'NO' },
      { input: '[({})]({})\n', expected: 'YES' },
    ],
    referencePython:
      'import sys\ns = sys.stdin.read().strip()\npairs = {")": "(", "]": "[", "}": "{"}\nstack = []\nok = True\nfor ch in s:\n    if ch in "([{":\n        stack.append(ch)\n    elif ch in pairs:\n        if not stack or stack.pop() != pairs[ch]:\n            ok = False\n            break\nprint("YES" if ok and not stack else "NO")\n',
    editorial:
      'Push openers, and on each closer check that the stack top is its matching opener. Two failure modes must both be handled: a closer arriving when the stack is empty or mismatched (detected mid-scan), and leftover openers at the end (detected after the loop). Forgetting the second check is the most common bug.',
    concept: 'Whenever "most recently opened" matters, a stack is the natural structure.',
  },

  {
    id: 'COD-0009',
    title: 'Binary Search Index',
    body:
      'Given a sorted array of N distinct integers and a target X, print the 0-based index of X, or -1 if it is absent. Your solution must run in O(log N).',
    topic: 'searching',
    subtopic: 'binary-search',
    difficulty: 'easy',
    expectedSeconds: 480,
    companies: ['tcs', 'infosys', 'walmart', 'salesforce'],
    inputFormat: 'The first line contains N and X. The second line contains N sorted space-separated integers.',
    outputFormat: 'The index of X, or -1.',
    constraints: '1 ≤ N ≤ 10^5, values are strictly increasing',
    starterCode: STARTERS,
    samples: [
      { input: '5 7\n1 3 5 7 9\n', expected: '3' },
      { input: '5 4\n1 3 5 7 9\n', expected: '-1' },
    ],
    hidden: [
      { input: '1 1\n1\n', expected: '0' },
      { input: '1 2\n1\n', expected: '-1' },
      { input: '6 1\n1 2 3 4 5 6\n', expected: '0' },
      { input: '6 6\n1 2 3 4 5 6\n', expected: '5' },
      { input: '7 -3\n-9 -7 -5 -3 0 4 8\n', expected: '3' },
    ],
    referencePython:
      'import sys\ndata = sys.stdin.read().split()\nn, x = int(data[0]), int(data[1])\narr = list(map(int, data[2:2 + n]))\nlo, hi = 0, n - 1\nans = -1\nwhile lo <= hi:\n    mid = (lo + hi) // 2\n    if arr[mid] == x:\n        ans = mid\n        break\n    if arr[mid] < x:\n        lo = mid + 1\n    else:\n        hi = mid - 1\nprint(ans)\n',
    editorial:
      'Standard binary search on a closed interval [lo, hi]. Use mid = lo + (hi − lo)/2 in C/C++/Java to avoid integer overflow on large indices, and make sure each branch strictly shrinks the interval or the loop will not terminate.',
    hint: 'Check the boundaries: does your loop still work when N = 1?',
  },

  {
    id: 'COD-0010',
    title: 'Climbing Stairs',
    body:
      'You climb a staircase of N steps, taking either 1 or 2 steps at a time. Print the number of distinct ways to reach the top, modulo 1,000,000,007.',
    topic: 'dynamic-programming',
    subtopic: 'dp-1d',
    difficulty: 'medium',
    expectedSeconds: 540,
    frequentlyAsked: true,
    companies: ['amazon', 'microsoft', 'adobe', 'cognizant'],
    inputFormat: 'A single line containing N.',
    outputFormat: 'The number of ways modulo 1000000007.',
    constraints: '1 ≤ N ≤ 10^6',
    starterCode: STARTERS,
    samples: [
      { input: '3\n', expected: '3', explanation: '1+1+1, 1+2 and 2+1.' },
      { input: '4\n', expected: '5' },
    ],
    hidden: [
      { input: '1\n', expected: '1' },
      { input: '2\n', expected: '2' },
      { input: '10\n', expected: '89' },
      { input: '45\n', expected: '836311896' },
      { input: '100\n', expected: '782204094' },
    ],
    referencePython:
      'import sys\nn = int(sys.stdin.read().split()[0])\nMOD = 1000000007\na, b = 1, 1\nfor _ in range(n - 1):\n    a, b = b, (a + b) % MOD\nprint(b % MOD)\n',
    editorial:
      'ways(n) = ways(n−1) + ways(n−2) — the Fibonacci recurrence. Iterate with two rolling variables for O(n) time and O(1) space. Recursion without memoisation is O(2^n) and will time out. The modulus exists because the answer overflows 64-bit integers well before N = 10^6.',
    concept: 'Rolling variables replace a DP array whenever the recurrence only looks back a fixed distance.',
    hint: 'From how many places can you arrive at step n?',
  },

  {
    id: 'COD-0011',
    title: 'Merge Two Sorted Arrays',
    body:
      'Given two sorted arrays, print all their elements merged into a single sorted sequence, separated by single spaces.',
    topic: 'arrays',
    subtopic: 'two-pointers',
    difficulty: 'medium',
    expectedSeconds: 540,
    companies: ['tcs', 'wipro', 'amazon', 'walmart'],
    inputFormat:
      'The first line contains N and M. The second line contains N sorted integers. The third line contains M sorted integers.',
    outputFormat: 'The merged sorted sequence on one line, space-separated.',
    constraints: '1 ≤ N, M ≤ 10^5',
    starterCode: STARTERS,
    samples: [
      { input: '3 3\n1 3 5\n2 4 6\n', expected: '1 2 3 4 5 6' },
      { input: '2 3\n1 1\n1 1 1\n', expected: '1 1 1 1 1', explanation: 'Duplicates are preserved.' },
    ],
    hidden: [
      { input: '1 1\n5\n2\n', expected: '2 5' },
      { input: '3 2\n-5 -1 0\n-9 7\n', expected: '-9 -5 -1 0 7' },
      { input: '4 1\n1 2 3 4\n5\n', expected: '1 2 3 4 5' },
      { input: '1 4\n9\n1 2 3 4\n', expected: '1 2 3 4 9' },
    ],
    referencePython:
      'import sys\ndata = sys.stdin.read().split()\nn, m = int(data[0]), int(data[1])\na = list(map(int, data[2:2 + n]))\nb = list(map(int, data[2 + n:2 + n + m]))\nout = []\ni = j = 0\nwhile i < n and j < m:\n    if a[i] <= b[j]:\n        out.append(a[i]); i += 1\n    else:\n        out.append(b[j]); j += 1\nout.extend(a[i:])\nout.extend(b[j:])\nprint(" ".join(map(str, out)))\n',
    editorial:
      'Walk both arrays with two pointers, always taking the smaller head, then append whatever remains of the non-exhausted array. O(N + M) time. Concatenating and re-sorting works but is O((N+M) log(N+M)) and throws away the sortedness you were given — interviewers ask this problem specifically to see whether you exploit it.',
    concept: 'This merge step is the heart of merge sort.',
  },

  {
    id: 'COD-0012',
    title: 'Rotate Array by K',
    body:
      'Given an array of N integers, rotate it right by K positions and print the result. K may exceed N.',
    topic: 'arrays',
    difficulty: 'medium',
    expectedSeconds: 540,
    companies: ['tcs', 'infosys', 'amazon', 'adobe'],
    inputFormat: 'The first line contains N and K. The second line contains N space-separated integers.',
    outputFormat: 'The rotated array on one line, space-separated.',
    constraints: '1 ≤ N ≤ 10^5, 0 ≤ K ≤ 10^9',
    starterCode: STARTERS,
    samples: [
      { input: '5 2\n1 2 3 4 5\n', expected: '4 5 1 2 3', explanation: 'Each element moves two positions to the right, wrapping around.' },
      { input: '4 6\n1 2 3 4\n', expected: '3 4 1 2', explanation: '6 mod 4 = 2, so this is a rotation by 2.' },
    ],
    hidden: [
      { input: '3 0\n7 8 9\n', expected: '7 8 9' },
      { input: '3 3\n7 8 9\n', expected: '7 8 9' },
      { input: '1 1000000000\n5\n', expected: '5' },
      { input: '6 4\n1 2 3 4 5 6\n', expected: '3 4 5 6 1 2' },
    ],
    referencePython:
      'import sys\ndata = sys.stdin.read().split()\nn, k = int(data[0]), int(data[1])\narr = list(map(int, data[2:2 + n]))\nk %= n\nprint(" ".join(map(str, arr[n - k:] + arr[:n - k])))\n',
    editorial:
      'Reduce K modulo N first — this is the step candidates most often forget, and it is exactly why K is allowed to reach 10^9. Then either slice and concatenate, or rotate in place with the three-reversal trick (reverse all, reverse the first K, reverse the rest) for O(1) extra space.',
    concept: 'Three reversals give an in-place rotation.',
    hint: 'What does a rotation by exactly N do?',
  },

  {
    id: 'COD-0013',
    title: 'Count Islands',
    body:
      'A grid of R rows and C columns contains 0s (water) and 1s (land). Count the number of islands, where an island is a maximal group of 1s connected horizontally or vertically (not diagonally).',
    topic: 'graphs',
    subtopic: 'bfs-dfs',
    difficulty: 'hard',
    expectedSeconds: 900,
    frequentlyAsked: true,
    companies: ['amazon', 'microsoft', 'google', 'walmart'],
    inputFormat: 'The first line contains R and C. The next R lines each contain C characters (0 or 1) with no separators.',
    outputFormat: 'The number of islands.',
    constraints: '1 ≤ R, C ≤ 500',
    starterCode: STARTERS,
    samples: [
      {
        input: '4 5\n11000\n11000\n00100\n00011\n',
        expected: '3',
        explanation: 'The 2×2 block, the single cell, and the two-cell group at the bottom right.',
      },
      { input: '1 3\n101\n', expected: '2' },
    ],
    hidden: [
      { input: '1 1\n0\n', expected: '0' },
      { input: '1 1\n1\n', expected: '1' },
      { input: '3 3\n111\n111\n111\n', expected: '1' },
      { input: '3 3\n101\n010\n101\n', expected: '5' },
      { input: '2 4\n1010\n0101\n', expected: '4' },
    ],
    referencePython:
      'import sys\nfrom collections import deque\ndata = sys.stdin.read().split()\nr, c = int(data[0]), int(data[1])\ngrid = [list(row) for row in data[2:2 + r]]\ncount = 0\nfor i in range(r):\n    for j in range(c):\n        if grid[i][j] == "1":\n            count += 1\n            q = deque([(i, j)])\n            grid[i][j] = "0"\n            while q:\n                x, y = q.popleft()\n                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):\n                    nx, ny = x + dx, y + dy\n                    if 0 <= nx < r and 0 <= ny < c and grid[nx][ny] == "1":\n                        grid[nx][ny] = "0"\n                        q.append((nx, ny))\nprint(count)\n',
    editorial:
      'Scan every cell. On finding an unvisited 1, increment the counter and flood-fill the whole component with BFS or DFS, marking cells visited as you go. Each cell is processed once, so the total cost is O(R·C). Prefer an explicit queue over recursion: a 500×500 all-land grid would recurse 250 000 deep and overflow the stack in most languages.',
    concept: 'Counting connected components = one traversal per unvisited seed.',
    hint: 'Mark cells as visited the moment you enqueue them, not when you dequeue them.',
  },

  {
    id: 'COD-0014',
    title: 'Longest Increasing Subsequence',
    body:
      'Given an array of N integers, print the length of the longest strictly increasing subsequence. The subsequence need not be contiguous.',
    topic: 'dynamic-programming',
    difficulty: 'hard',
    expectedSeconds: 900,
    frequentlyAsked: true,
    companies: ['amazon', 'microsoft', 'google', 'adobe', 'salesforce'],
    inputFormat: 'The first line contains N. The second line contains N space-separated integers.',
    outputFormat: 'The length of the longest strictly increasing subsequence.',
    constraints: '1 ≤ N ≤ 10^5, −10^9 ≤ A[i] ≤ 10^9',
    starterCode: STARTERS,
    samples: [
      {
        input: '8\n10 9 2 5 3 7 101 18\n',
        expected: '4',
        explanation: 'One longest increasing subsequence is 2, 3, 7, 101.',
      },
      { input: '4\n7 7 7 7\n', expected: '1', explanation: 'Strictly increasing, so equal values cannot extend a run.' },
    ],
    hidden: [
      { input: '1\n5\n', expected: '1' },
      { input: '5\n5 4 3 2 1\n', expected: '1' },
      { input: '5\n1 2 3 4 5\n', expected: '5' },
      { input: '6\n3 10 2 1 20 4\n', expected: '3' },
      { input: '9\n1 3 6 7 9 4 10 5 6\n', expected: '6' },
    ],
    referencePython:
      'import sys\nfrom bisect import bisect_left\ndata = sys.stdin.read().split()\nn = int(data[0])\narr = list(map(int, data[1:1 + n]))\ntails = []\nfor v in arr:\n    i = bisect_left(tails, v)\n    if i == len(tails):\n        tails.append(v)\n    else:\n        tails[i] = v\nprint(len(tails))\n',
    editorial:
      'The O(n²) DP (for each i, scan all j < i) is correct but too slow at N = 10^5. The patience-sorting approach keeps `tails[k]` = the smallest possible tail of an increasing subsequence of length k+1; this array is sorted, so binary search places each value in O(log n) for O(n log n) overall. Use lower_bound (bisect_left) for *strictly* increasing and upper_bound for non-decreasing — that single choice is the difference between the two variants.',
    concept: 'The tails array is not itself an LIS; only its length is meaningful.',
    hint: 'Keep the smallest tail for every achievable length.',
  },

  {
    id: 'COD-0015',
    title: '0/1 Knapsack',
    body:
      'Given N items with weights and values, and a knapsack of capacity W, print the maximum total value obtainable. Each item may be taken at most once.',
    topic: 'dynamic-programming',
    subtopic: 'dp-knapsack',
    difficulty: 'hard',
    expectedSeconds: 900,
    frequentlyAsked: true,
    companies: ['amazon', 'microsoft', 'google', 'deloitte'],
    inputFormat:
      'The first line contains N and W. The second line contains N weights. The third line contains N values.',
    outputFormat: 'The maximum achievable value.',
    constraints: '1 ≤ N ≤ 100, 1 ≤ W ≤ 10000, weights and values are positive integers up to 10^4',
    starterCode: STARTERS,
    samples: [
      {
        input: '3 50\n10 20 30\n60 100 120\n',
        expected: '220',
        explanation: 'Take the items weighing 20 and 30 for 100 + 120 = 220.',
      },
      { input: '2 3\n4 5\n10 20\n', expected: '0', explanation: 'Neither item fits in the knapsack.' },
    ],
    hidden: [
      { input: '1 5\n5\n7\n', expected: '7' },
      { input: '1 4\n5\n7\n', expected: '0' },
      { input: '4 10\n5 4 6 3\n10 40 30 50\n', expected: '90' },
      { input: '5 15\n1 2 3 4 5\n10 20 30 40 50\n', expected: '150' },
      { input: '3 6\n2 3 4\n3 4 5\n', expected: '8' },
    ],
    referencePython:
      'import sys\ndata = sys.stdin.read().split()\nn, w = int(data[0]), int(data[1])\nwt = list(map(int, data[2:2 + n]))\nval = list(map(int, data[2 + n:2 + 2 * n]))\ndp = [0] * (w + 1)\nfor i in range(n):\n    for cap in range(w, wt[i] - 1, -1):\n        cand = dp[cap - wt[i]] + val[i]\n        if cand > dp[cap]:\n            dp[cap] = cand\nprint(dp[w])\n',
    editorial:
      'Classic O(N·W) DP. The one-dimensional rolling array must be iterated **downwards** over capacity: going upwards would let the same item be reused within one iteration, silently turning this into the unbounded knapsack problem. That direction is the single most common bug in this problem.',
    concept: 'Descending capacity iteration enforces "at most once" for each item.',
    hint: 'What goes wrong if you iterate capacity from low to high?',
  },

  {
    id: 'COD-0016',
    title: 'Minimum Coins',
    body:
      'Given N coin denominations and a target amount A, print the minimum number of coins summing to exactly A, or -1 if it is impossible. You have unlimited coins of each denomination.',
    topic: 'dynamic-programming',
    difficulty: 'hard',
    expectedSeconds: 840,
    companies: ['amazon', 'microsoft', 'walmart', 'salesforce'],
    inputFormat: 'The first line contains N and A. The second line contains N denominations.',
    outputFormat: 'The minimum coin count, or -1.',
    constraints: '1 ≤ N ≤ 50, 1 ≤ A ≤ 10^4, denominations are positive integers up to 10^4',
    starterCode: STARTERS,
    samples: [
      { input: '3 11\n1 2 5\n', expected: '3', explanation: '5 + 5 + 1 = 11 uses three coins.' },
      { input: '1 7\n3\n', expected: '-1', explanation: 'No combination of 3s sums to 7.' },
    ],
    hidden: [
      { input: '1 6\n3\n', expected: '2' },
      { input: '4 30\n25 10 5 1\n', expected: '2' },
      { input: '3 30\n25 10 1\n', expected: '3' },
      { input: '2 9999\n1 5000\n', expected: '5000' },
      { input: '3 13\n7 5 1\n', expected: '3' },
    ],
    referencePython:
      'import sys\ndata = sys.stdin.read().split()\nn, amount = int(data[0]), int(data[1])\ncoins = list(map(int, data[2:2 + n]))\nINF = float("inf")\ndp = [0] + [INF] * amount\nfor a in range(1, amount + 1):\n    for c in coins:\n        if c <= a and dp[a - c] + 1 < dp[a]:\n            dp[a] = dp[a - c] + 1\nprint(dp[amount] if dp[amount] != INF else -1)\n',
    editorial:
      'Unbounded knapsack variant: dp[a] = 1 + min over coins c ≤ a of dp[a − c], with dp[0] = 0. O(N·A) time. A greedy "always take the largest coin" strategy is wrong for general denominations — the {25, 10, 1} case with A = 30 shows it: greedy gives 25 + 1×5 = 6 coins, while the optimum is 10 + 10 + 10 = 3.',
    concept: 'Greedy coin change is only optimal for canonical coin systems.',
    hint: 'Build up from amount 0 and reuse smaller answers.',
  },
];
