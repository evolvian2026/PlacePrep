import type { RoundType } from '../../types.js';
import type { McqSeed } from './types.js';

const TECH: RoundType[] = ['technical_mcq', 'technical_interview'];
const TECH_APT: RoundType[] = ['technical_mcq', 'technical_interview', 'aptitude'];
const DESIGN: RoundType[] = ['technical_interview', 'system_design'];

/** OOPS, DBMS, SQL, OS, networks, programming fundamentals and DSA theory. */
export const TECHNICAL_QUESTIONS: McqSeed[] = [
  // ══════════════════════════ OOPS ══════════════════════════
  {
    id: 'OOP-0001',
    body: 'Which OOP concept allows a single interface to be used for different underlying data types?',
    topic: 'oops',
    subtopic: 'polymorphism',
    difficulty: 'easy',
    expectedSeconds: 40,
    roundTypes: TECH,
    frequentlyAsked: true,
    options: [
      { body: 'Polymorphism', correct: true },
      { body: 'Encapsulation', whyWrong: 'Encapsulation is about bundling data with the methods that operate on it and restricting direct access.' },
      { body: 'Inheritance', whyWrong: 'Inheritance is about deriving one class from another; it enables but is not itself the "one interface, many types" idea.' },
      { body: 'Abstraction', whyWrong: 'Abstraction hides implementation detail behind a simpler model.' },
    ],
    explanation:
      'Polymorphism literally means "many forms" — the same call site dispatches to different implementations depending on the runtime type of the object.',
    concept: 'Compile-time polymorphism uses overloading; run-time polymorphism uses overriding through a base-class reference.',
  },
  {
    id: 'OOP-0002',
    body: 'In Java, what is the difference between method overloading and method overriding?',
    topic: 'oops',
    subtopic: 'polymorphism',
    difficulty: 'medium',
    expectedSeconds: 60,
    roundTypes: TECH,
    frequentlyAsked: true,
    options: [
      {
        body: 'Overloading resolves at compile time using the signature; overriding resolves at run time using the object type.',
        correct: true,
      },
      {
        body: 'Overloading resolves at run time; overriding resolves at compile time.',
        whyWrong: 'The two are reversed — dynamic dispatch is what makes overriding a run-time mechanism.',
      },
      {
        body: 'Both resolve at compile time.',
        whyWrong: 'Overriding must be resolved at run time because the actual object type is not known until then.',
      },
      {
        body: 'Overloading requires inheritance; overriding does not.',
        whyWrong: 'It is the other way round: overriding requires an inheritance relationship, overloading does not.',
      },
    ],
    explanation:
      'Overloading means several methods share a name but differ in parameter list; the compiler picks one from the static types. Overriding means a subclass replaces a superclass method with the same signature; the JVM picks the implementation from the object’s actual class at run time.',
    concept: 'Overloading = static/compile-time binding. Overriding = dynamic/run-time binding.',
  },
  {
    id: 'OOP-0003',
    body: 'Which statement about abstract classes and interfaces (in modern Java) is correct?',
    topic: 'oops',
    subtopic: 'encapsulation-abstraction',
    difficulty: 'medium',
    expectedSeconds: 60,
    roundTypes: TECH,
    options: [
      {
        body: 'A class can extend only one abstract class but implement many interfaces.',
        correct: true,
      },
      {
        body: 'A class can extend many abstract classes but implement only one interface.',
        whyWrong: 'Java does not permit multiple class inheritance; the restriction applies to classes, not interfaces.',
      },
      {
        body: 'Interfaces cannot contain any method body at all.',
        whyWrong: 'Since Java 8 interfaces may contain default and static methods with bodies.',
      },
      {
        body: 'Abstract classes cannot have constructors.',
        whyWrong: 'Abstract classes do have constructors, invoked via super() when a concrete subclass is instantiated.',
      },
    ],
    explanation:
      'Java allows single class inheritance but multiple interface implementation, which is how it avoids the classic diamond problem while still supporting multiple type contracts.',
  },
  {
    id: 'OOP-0004',
    body: 'What does the Single Responsibility Principle state?',
    topic: 'oops',
    subtopic: 'solid-principles',
    difficulty: 'easy',
    expectedSeconds: 45,
    roundTypes: TECH,
    options: [
      { body: 'A class should have only one reason to change.', correct: true },
      { body: 'A class should have only one public method.', whyWrong: 'The principle is about reasons to change, not a method count.' },
      { body: 'A class should inherit from only one parent.', whyWrong: 'That describes single inheritance, a language rule rather than a design principle.' },
      { body: 'A method should take only one argument.', whyWrong: 'Argument count is a style concern, unrelated to SRP.' },
    ],
    explanation:
      'SRP says a class should have a single responsibility — equivalently, one axis of change. If two different stakeholders can force edits to the same class, it likely has two responsibilities.',
  },
  {
    id: 'OOP-0005',
    body: 'What is the output? \n```java\nclass A { void show() { System.out.println("A"); } }\nclass B extends A { void show() { System.out.println("B"); } }\n// in main:\nA obj = new B();\nobj.show();\n```',
    topic: 'oops',
    subtopic: 'polymorphism',
    difficulty: 'medium',
    expectedSeconds: 50,
    roundTypes: TECH,
    frequentlyAsked: true,
    options: [
      { body: 'B', correct: true },
      { body: 'A', whyWrong: 'The reference type is A, but instance methods dispatch on the object’s runtime type, which is B.' },
      { body: 'Compilation error', whyWrong: 'Assigning a subclass instance to a superclass reference is legal.' },
      { body: 'A followed by B', whyWrong: 'Only one method executes; the override replaces the base implementation.' },
    ],
    explanation:
      'The object is a B, and show() is overridden, so dynamic dispatch selects B.show(). The declared type A only limits which members you may call.',
    concept: 'Fields are resolved statically in Java; instance methods are resolved dynamically.',
  },
  {
    id: 'OOP-0006',
    body: 'Which of these best describes composition over inheritance?',
    topic: 'oops',
    subtopic: 'inheritance',
    difficulty: 'medium',
    expectedSeconds: 55,
    roundTypes: TECH,
    options: [
      {
        body: 'Prefer holding a reference to another object ("has-a") over deriving from it ("is-a") when you only need its behaviour.',
        correct: true,
      },
      {
        body: 'Always avoid inheritance because it is deprecated in modern languages.',
        whyWrong: 'Inheritance is not deprecated; it is simply the wrong tool when there is no genuine is-a relationship.',
      },
      {
        body: 'Composition means combining two classes into one large class.',
        whyWrong: 'That is merging, not composition. Composition keeps the collaborator as a separate object.',
      },
      {
        body: 'Composition means making all fields public so other classes can reuse them.',
        whyWrong: 'That breaks encapsulation and is unrelated to composition.',
      },
    ],
    explanation:
      'Inheritance couples a subclass to its parent’s implementation. Composition delegates to a held object, which is easier to change, test and swap at run time.',
  },

  // ══════════════════════════ DBMS ══════════════════════════
  {
    id: 'DBM-0001',
    body: 'A relation is in 2NF but has a transitive dependency A → B → C where A is the primary key. Which normal form does it violate?',
    topic: 'dbms',
    subtopic: 'normalization',
    difficulty: 'medium',
    expectedSeconds: 60,
    roundTypes: TECH,
    frequentlyAsked: true,
    options: [
      { body: '3NF', correct: true },
      { body: '1NF', whyWrong: '1NF only requires atomic values — a transitive dependency does not breach it.' },
      { body: '2NF', whyWrong: 'The relation is stated to already be in 2NF, which forbids partial (not transitive) dependencies.' },
      { body: 'BCNF only', whyWrong: 'A 3NF violation is automatically a BCNF violation too, so 3NF is the tighter answer.' },
    ],
    explanation:
      '3NF forbids a non-prime attribute being transitively dependent on the key. Here C depends on B, which depends on A, so C is transitively dependent on the key — a 3NF violation.',
    concept: '1NF: atomic values. 2NF: no partial dependency on part of a composite key. 3NF: no transitive dependency.',
  },
  {
    id: 'DBM-0002',
    body: 'What does the "I" in ACID guarantee?',
    topic: 'dbms',
    subtopic: 'transactions-acid',
    difficulty: 'easy',
    expectedSeconds: 45,
    roundTypes: TECH,
    frequentlyAsked: true,
    options: [
      {
        body: 'Concurrent transactions do not observe each other’s intermediate state.',
        correct: true,
      },
      { body: 'Committed data survives a crash.', whyWrong: 'That is Durability.' },
      { body: 'A transaction either completes fully or not at all.', whyWrong: 'That is Atomicity.' },
      { body: 'The database moves between valid states only.', whyWrong: 'That is Consistency.' },
    ],
    explanation:
      'Isolation means concurrently executing transactions are shielded from each other’s uncommitted changes, so the outcome is as if they ran in some serial order.',
  },
  {
    id: 'DBM-0003',
    body: 'Which anomaly does a "dirty read" describe?',
    topic: 'dbms',
    subtopic: 'transactions-acid',
    difficulty: 'medium',
    expectedSeconds: 55,
    roundTypes: TECH,
    options: [
      { body: 'Reading data written by a transaction that has not yet committed.', correct: true },
      { body: 'Reading the same row twice and getting different values.', whyWrong: 'That is a non-repeatable read.' },
      { body: 'A query returning extra rows on re-execution.', whyWrong: 'That is a phantom read.' },
      { body: 'Two transactions waiting on each other forever.', whyWrong: 'That is a deadlock, not a read anomaly.' },
    ],
    explanation:
      'A dirty read exposes uncommitted changes. If the writer later rolls back, the reader has acted on data that never officially existed. READ COMMITTED and above prevent it.',
    concept: 'Isolation levels ascend: READ UNCOMMITTED → READ COMMITTED → REPEATABLE READ → SERIALIZABLE.',
  },
  {
    id: 'DBM-0004',
    body: 'Which index structure is most appropriate for range queries such as "WHERE salary BETWEEN 50000 AND 80000"?',
    topic: 'dbms',
    subtopic: 'indexing',
    difficulty: 'medium',
    expectedSeconds: 55,
    roundTypes: TECH,
    options: [
      { body: 'B+ tree index', correct: true },
      { body: 'Hash index', whyWrong: 'Hash indexes support equality lookups only; they do not preserve ordering, so ranges require a full scan.' },
      { body: 'Bitmap index on a high-cardinality column', whyWrong: 'Bitmap indexes suit low-cardinality columns and are not designed for numeric ranges.' },
      { body: 'No index — a full table scan is always faster', whyWrong: 'For a selective range a B+ tree scan of the leaf chain is typically far cheaper than a full scan.' },
    ],
    explanation:
      'B+ trees keep keys sorted and link leaf nodes, so a range query seeks once to the lower bound and then walks the leaves until the upper bound.',
  },
  {
    id: 'DBM-0005',
    body: 'What is the difference between a primary key and a unique key?',
    topic: 'dbms',
    subtopic: 'er-modelling',
    difficulty: 'easy',
    expectedSeconds: 50,
    roundTypes: TECH,
    frequentlyAsked: true,
    options: [
      {
        body: 'A table has at most one primary key and it cannot be NULL; unique keys can be multiple and typically allow one NULL.',
        correct: true,
      },
      {
        body: 'Both allow NULL values and there can be many of each.',
        whyWrong: 'A primary key can never be NULL and a table may have only one.',
      },
      {
        body: 'A unique key cannot be referenced by a foreign key.',
        whyWrong: 'Foreign keys may reference any uniquely constrained column, not just the primary key.',
      },
      {
        body: 'A primary key does not create an index.',
        whyWrong: 'Primary keys are backed by a unique index in every mainstream RDBMS.',
      },
    ],
    explanation:
      'Both enforce uniqueness. The primary key is the single chosen identifier for the row and is NOT NULL; additional unique constraints express alternate keys and generally permit a NULL.',
  },
  {
    id: 'DBM-0006',
    body: 'A relation R(A, B, C, D) has functional dependencies AB → C and C → D. What is the highest normal form R satisfies (assuming AB is the only candidate key)?',
    topic: 'dbms',
    subtopic: 'normalization',
    difficulty: 'hard',
    expectedSeconds: 80,
    roundTypes: TECH,
    options: [
      { body: '2NF', correct: true },
      { body: '3NF', whyWrong: 'D is transitively dependent on the key through C, which 3NF forbids.' },
      { body: 'BCNF', whyWrong: 'BCNF is stricter than 3NF, and 3NF already fails here.' },
      { body: '1NF only', whyWrong: 'No non-prime attribute depends on part of AB alone, so 2NF is satisfied.' },
    ],
    explanation:
      'No attribute depends on just A or just B, so 2NF holds. But C → D with C non-prime creates a transitive dependency AB → C → D, breaking 3NF. The highest form satisfied is therefore 2NF.',
  },

  // ══════════════════════════ SQL ══════════════════════════
  {
    id: 'SQL-0001',
    body: 'Which join returns all rows from the left table and matching rows from the right, with NULLs where no match exists?',
    topic: 'sql',
    subtopic: 'joins',
    difficulty: 'easy',
    expectedSeconds: 40,
    roundTypes: TECH,
    frequentlyAsked: true,
    options: [
      { body: 'LEFT OUTER JOIN', correct: true },
      { body: 'INNER JOIN', whyWrong: 'An inner join drops left rows that have no match.' },
      { body: 'RIGHT OUTER JOIN', whyWrong: 'That preserves the right table instead of the left.' },
      { body: 'CROSS JOIN', whyWrong: 'A cross join produces the Cartesian product with no matching condition.' },
    ],
    explanation: 'LEFT OUTER JOIN preserves every left-hand row, padding unmatched right-hand columns with NULL.',
  },
  {
    id: 'SQL-0002',
    body:
      'Given `employees(id, name, dept_id, salary)`, which query returns the second-highest salary?',
    topic: 'sql',
    subtopic: 'subqueries',
    difficulty: 'medium',
    expectedSeconds: 75,
    roundTypes: TECH,
    frequentlyAsked: true,
    options: [
      {
        body: 'SELECT MAX(salary) FROM employees WHERE salary < (SELECT MAX(salary) FROM employees);',
        correct: true,
      },
      {
        body: 'SELECT salary FROM employees ORDER BY salary DESC LIMIT 1;',
        whyWrong: 'This returns the highest salary, not the second highest.',
      },
      {
        body: 'SELECT MAX(salary) FROM employees WHERE salary <= (SELECT MAX(salary) FROM employees);',
        whyWrong: 'The `<=` includes the maximum itself, so this returns the highest salary again.',
      },
      {
        body: 'SELECT MIN(salary) FROM employees WHERE salary > (SELECT MIN(salary) FROM employees);',
        whyWrong: 'This finds the second-lowest salary.',
      },
    ],
    explanation:
      'Excluding the maximum with a strict `<` and then taking MAX of what remains yields the second-highest distinct salary. A window function (DENSE_RANK) is the modern alternative.',
    concept: 'Beware of ties: this pattern returns the second-highest distinct value.',
  },
  {
    id: 'SQL-0003',
    body: 'What is the difference between WHERE and HAVING?',
    topic: 'sql',
    subtopic: 'aggregations',
    difficulty: 'easy',
    expectedSeconds: 50,
    roundTypes: TECH,
    frequentlyAsked: true,
    options: [
      { body: 'WHERE filters rows before grouping; HAVING filters groups after aggregation.', correct: true },
      { body: 'They are interchangeable in all queries.', whyWrong: 'HAVING can reference aggregates; WHERE cannot, because aggregates are not yet computed.' },
      { body: 'HAVING filters rows before grouping; WHERE filters after.', whyWrong: 'The two are reversed.' },
      { body: 'WHERE works only on indexed columns.', whyWrong: 'WHERE works on any column; indexing only affects performance.' },
    ],
    explanation:
      'Logical processing order is FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY. That is why HAVING can use COUNT(*) or SUM(...) but WHERE cannot.',
  },
  {
    id: 'SQL-0004',
    body: 'How many rows does `SELECT COUNT(*)` versus `SELECT COUNT(col)` return differently when `col` contains NULLs?',
    topic: 'sql',
    subtopic: 'aggregations',
    difficulty: 'medium',
    expectedSeconds: 50,
    roundTypes: TECH,
    options: [
      { body: 'COUNT(*) counts all rows; COUNT(col) skips rows where col IS NULL.', correct: true },
      { body: 'Both count all rows identically.', whyWrong: 'Aggregate functions other than COUNT(*) ignore NULL inputs.' },
      { body: 'COUNT(*) skips NULLs; COUNT(col) counts everything.', whyWrong: 'This is reversed.' },
      { body: 'COUNT(col) raises an error if col contains NULL.', whyWrong: 'NULLs are silently ignored, not an error.' },
    ],
    explanation: 'COUNT(*) counts rows. COUNT(expression) counts non-NULL evaluations of that expression.',
  },
  {
    id: 'SQL-0005',
    body:
      'Which query lists each department with more than 5 employees, showing the department id and the count?',
    topic: 'sql',
    subtopic: 'aggregations',
    difficulty: 'medium',
    expectedSeconds: 65,
    roundTypes: TECH,
    options: [
      {
        body: 'SELECT dept_id, COUNT(*) FROM employees GROUP BY dept_id HAVING COUNT(*) > 5;',
        correct: true,
      },
      {
        body: 'SELECT dept_id, COUNT(*) FROM employees WHERE COUNT(*) > 5 GROUP BY dept_id;',
        whyWrong: 'WHERE cannot reference an aggregate — it is evaluated before grouping.',
      },
      {
        body: 'SELECT dept_id, COUNT(*) FROM employees GROUP BY COUNT(*) HAVING dept_id > 5;',
        whyWrong: 'Grouping by an aggregate is invalid, and the filter tests the wrong column.',
      },
      {
        body: 'SELECT dept_id, COUNT(*) FROM employees ORDER BY COUNT(*) > 5;',
        whyWrong: 'ORDER BY sorts; it does not filter.',
      },
    ],
    explanation: 'Group by the department, then filter the resulting groups with HAVING on the aggregate.',
  },
  {
    id: 'SQL-0006',
    body: 'Which window function assigns 1, 2, 2, 4 to values ordered with a tie in second place?',
    topic: 'sql',
    subtopic: 'window-functions',
    difficulty: 'hard',
    expectedSeconds: 70,
    roundTypes: TECH,
    options: [
      { body: 'RANK()', correct: true },
      { body: 'DENSE_RANK()', whyWrong: 'DENSE_RANK would produce 1, 2, 2, 3 — it does not leave gaps after ties.' },
      { body: 'ROW_NUMBER()', whyWrong: 'ROW_NUMBER always gives distinct 1, 2, 3, 4 and breaks ties arbitrarily.' },
      { body: 'NTILE(4)', whyWrong: 'NTILE distributes rows into buckets rather than ranking them.' },
    ],
    explanation:
      'RANK() gives tied rows the same rank and then skips ranks, producing the gap (1, 2, 2, 4). DENSE_RANK closes the gap; ROW_NUMBER never ties.',
  },
  {
    id: 'SQL-0007',
    body: 'What does `DELETE FROM employees;` do differently from `TRUNCATE TABLE employees;`?',
    topic: 'sql',
    subtopic: 'joins',
    difficulty: 'medium',
    expectedSeconds: 60,
    roundTypes: TECH,
    options: [
      {
        body: 'DELETE removes rows one at a time and can be rolled back per row with triggers firing; TRUNCATE deallocates pages wholesale and usually does not fire row triggers.',
        correct: true,
      },
      {
        body: 'They are identical in every respect.',
        whyWrong: 'They differ in logging, trigger behaviour, identity reset and typically in speed.',
      },
      {
        body: 'TRUNCATE can include a WHERE clause; DELETE cannot.',
        whyWrong: 'It is the reverse — DELETE accepts WHERE, TRUNCATE does not.',
      },
      {
        body: 'DELETE cannot be rolled back inside a transaction.',
        whyWrong: 'DELETE is fully transactional and can be rolled back.',
      },
    ],
    explanation:
      'DELETE is a DML row-by-row operation that logs each row and fires row triggers. TRUNCATE is closer to DDL: it drops storage in bulk, is much faster on large tables, and commonly resets identity counters.',
  },

  // ══════════════════════════ Operating systems ══════════════════════════
  {
    id: 'OS-0001',
    body: 'Which scheduling algorithm can cause starvation of long jobs?',
    topic: 'operating-systems',
    subtopic: 'cpu-scheduling',
    difficulty: 'medium',
    expectedSeconds: 55,
    roundTypes: TECH,
    frequentlyAsked: true,
    options: [
      { body: 'Shortest Job First', correct: true },
      { body: 'Round Robin', whyWrong: 'Round Robin gives every process a time slice, so no process waits indefinitely.' },
      { body: 'First Come First Serve', whyWrong: 'FCFS can cause the convoy effect but never indefinite starvation — every job eventually reaches the front.' },
      { body: 'Multilevel queue with aging', whyWrong: 'Aging exists precisely to prevent starvation by promoting long-waiting processes.' },
    ],
    explanation:
      'SJF always prefers the shortest burst, so a steady arrival of short jobs can postpone a long job indefinitely. Aging is the standard remedy.',
  },
  {
    id: 'OS-0002',
    body: 'Which of the four Coffman conditions, if broken, prevents deadlock by allowing resources to be taken back?',
    topic: 'operating-systems',
    subtopic: 'deadlocks',
    difficulty: 'medium',
    expectedSeconds: 60,
    roundTypes: TECH,
    options: [
      { body: 'No preemption', correct: true },
      { body: 'Mutual exclusion', whyWrong: 'Breaking mutual exclusion means sharing resources freely, which is unrelated to reclaiming them.' },
      { body: 'Hold and wait', whyWrong: 'Breaking this means acquiring all resources up front, not taking them back.' },
      { body: 'Circular wait', whyWrong: 'Breaking this means imposing a global ordering on resource requests.' },
    ],
    explanation:
      'The four necessary conditions are mutual exclusion, hold-and-wait, no preemption and circular wait. Allowing preemption lets the OS forcibly reclaim a held resource, breaking the "no preemption" condition.',
  },
  {
    id: 'OS-0003',
    body: 'What is thrashing in an operating system?',
    topic: 'operating-systems',
    subtopic: 'memory-management',
    difficulty: 'medium',
    expectedSeconds: 55,
    roundTypes: TECH,
    frequentlyAsked: true,
    options: [
      {
        body: 'The system spends more time servicing page faults than executing processes.',
        correct: true,
      },
      { body: 'Two threads repeatedly acquire the same lock.', whyWrong: 'That is lock contention or livelock, not thrashing.' },
      { body: 'The CPU scheduler switches between processes too rarely.', whyWrong: 'Thrashing is about paging, not scheduling frequency.' },
      { body: 'The disk fragments over time.', whyWrong: 'That is fragmentation, a storage-layout problem.' },
    ],
    explanation:
      'When the combined working set exceeds physical memory, pages are evicted almost as soon as they are loaded. CPU utilisation collapses because processes are constantly blocked on page faults.',
    concept: 'The remedy is to reduce the degree of multiprogramming or add memory — a working-set model detects it.',
  },
  {
    id: 'OS-0004',
    body: 'What is the key difference between a process and a thread?',
    topic: 'operating-systems',
    subtopic: 'process-management',
    difficulty: 'easy',
    expectedSeconds: 50,
    roundTypes: TECH,
    frequentlyAsked: true,
    options: [
      {
        body: 'Threads of one process share its address space; separate processes have isolated address spaces.',
        correct: true,
      },
      { body: 'Threads cannot run in parallel on multiple cores.', whyWrong: 'Threads are precisely the unit the kernel schedules onto cores.' },
      { body: 'A process cannot contain more than one thread.', whyWrong: 'Every process has at least one thread and may have many.' },
      { body: 'Processes are faster to create than threads.', whyWrong: 'Thread creation is cheaper because there is no new address space to build.' },
    ],
    explanation:
      'A process owns resources — address space, file descriptors — while threads are execution contexts inside it that share those resources but keep their own stack and registers.',
  },
  {
    id: 'OS-0005',
    body: 'Given page reference string 1, 2, 3, 4, 1, 2, 5 with 3 frames, how many page faults does FIFO incur?',
    topic: 'operating-systems',
    subtopic: 'memory-management',
    difficulty: 'hard',
    expectedSeconds: 100,
    roundTypes: TECH,
    options: [
      { body: '7', correct: true },
      { body: '5', whyWrong: 'Trace it again — none of the later references find their page still resident under FIFO.' },
      { body: '6', whyWrong: 'Every one of the seven references misses; recheck the eviction order.' },
      { body: '4', whyWrong: 'Far too few; only three frames are available for five distinct pages.' },
    ],
    explanation:
      'FIFO with 3 frames: 1(F)[1], 2(F)[1,2], 3(F)[1,2,3], 4(F evict 1)[2,3,4], 1(F evict 2)[3,4,1], 2(F evict 3)[4,1,2], 5(F evict 4)[1,2,5]. All seven references fault.',
    concept: 'This is the classic setup for Belady’s anomaly, where adding frames can increase FIFO faults.',
  },
  {
    id: 'OS-0006',
    body: 'A semaphore initialised to 1 and used with wait/signal around a critical section acts as:',
    topic: 'operating-systems',
    subtopic: 'concurrency',
    difficulty: 'medium',
    expectedSeconds: 50,
    roundTypes: TECH,
    options: [
      { body: 'A binary semaphore providing mutual exclusion', correct: true },
      { body: 'A counting semaphore allowing many concurrent entrants', whyWrong: 'A count of 1 permits only one entrant at a time.' },
      { body: 'A condition variable', whyWrong: 'Condition variables signal state changes and require an external lock.' },
      { body: 'A spinlock that never blocks', whyWrong: 'Semaphore wait blocks the caller rather than spinning.' },
    ],
    explanation: 'With an initial value of 1, at most one thread can pass wait() before another calls signal(), which is exactly mutual exclusion.',
  },

  // ══════════════════════════ Computer networks ══════════════════════════
  {
    id: 'CN-0001',
    body: 'Which layer of the OSI model does a router primarily operate at?',
    topic: 'computer-networks',
    subtopic: 'osi-tcpip',
    difficulty: 'easy',
    expectedSeconds: 40,
    roundTypes: TECH,
    frequentlyAsked: true,
    options: [
      { body: 'Network layer (Layer 3)', correct: true },
      { body: 'Data link layer (Layer 2)', whyWrong: 'Switches and bridges operate at Layer 2 using MAC addresses.' },
      { body: 'Transport layer (Layer 4)', whyWrong: 'Layer 4 is where TCP and UDP live; routers forward on IP addresses.' },
      { body: 'Physical layer (Layer 1)', whyWrong: 'Hubs and repeaters operate at Layer 1.' },
    ],
    explanation: 'Routers forward packets using IP addresses and routing tables, which is Layer 3 — the network layer.',
  },
  {
    id: 'CN-0002',
    body: 'Which statement about TCP versus UDP is correct?',
    topic: 'computer-networks',
    subtopic: 'tcp-udp',
    difficulty: 'easy',
    expectedSeconds: 50,
    roundTypes: TECH,
    frequentlyAsked: true,
    options: [
      {
        body: 'TCP guarantees ordered, reliable delivery with flow and congestion control; UDP does not.',
        correct: true,
      },
      { body: 'UDP is connection-oriented and TCP is connectionless.', whyWrong: 'This is reversed — TCP establishes a connection via a handshake.' },
      { body: 'UDP guarantees ordering but not reliability.', whyWrong: 'UDP guarantees neither ordering nor delivery.' },
      { body: 'TCP has a smaller header than UDP.', whyWrong: 'TCP’s header is at least 20 bytes versus UDP’s 8.' },
    ],
    explanation:
      'TCP adds sequence numbers, acknowledgements, retransmission, flow control and congestion control. UDP is a thin datagram service, which is why latency-sensitive traffic often prefers it.',
  },
  {
    id: 'CN-0003',
    body: 'How many usable host addresses does a /26 IPv4 subnet provide?',
    topic: 'computer-networks',
    subtopic: 'subnetting',
    difficulty: 'medium',
    expectedSeconds: 60,
    roundTypes: TECH,
    options: [
      { body: '62', correct: true },
      { body: '64', whyWrong: 'That is the total address count; the network and broadcast addresses are not usable hosts.' },
      { body: '30', whyWrong: 'That corresponds to a /27.' },
      { body: '126', whyWrong: 'That corresponds to a /25.' },
    ],
    explanation: 'A /26 leaves 6 host bits: 2⁶ = 64 addresses, minus the network and broadcast addresses, gives 62 usable hosts.',
    concept: 'Usable hosts = 2^(32 − prefix) − 2 for IPv4 subnets larger than /31.',
  },
  {
    id: 'CN-0004',
    body: 'What is the purpose of the TCP three-way handshake?',
    topic: 'computer-networks',
    subtopic: 'tcp-udp',
    difficulty: 'medium',
    expectedSeconds: 55,
    roundTypes: TECH,
    options: [
      {
        body: 'To synchronise initial sequence numbers and confirm both directions are reachable.',
        correct: true,
      },
      { body: 'To encrypt the connection.', whyWrong: 'Encryption is TLS’s job, layered above TCP.' },
      { body: 'To negotiate the IP addresses of both hosts.', whyWrong: 'Addresses are already known before the handshake begins.' },
      { body: 'To compress the payload.', whyWrong: 'TCP does not perform compression.' },
    ],
    explanation:
      'SYN, SYN-ACK, ACK lets each side advertise its initial sequence number and acknowledge the other’s, establishing a reliable bidirectional byte stream.',
  },
  {
    id: 'CN-0005',
    body: 'Which HTTP status code indicates that the client must authenticate to get the response?',
    topic: 'computer-networks',
    subtopic: 'http-dns',
    difficulty: 'easy',
    expectedSeconds: 40,
    roundTypes: TECH,
    options: [
      { body: '401 Unauthorized', correct: true },
      { body: '403 Forbidden', whyWrong: '403 means the server understood who you are and still refuses — authentication will not help.' },
      { body: '404 Not Found', whyWrong: '404 means the resource does not exist.' },
      { body: '500 Internal Server Error', whyWrong: '500 signals a server-side fault.' },
    ],
    explanation:
      '401 means "unauthenticated" despite its name, and the response carries a WWW-Authenticate header. 403 means authenticated but not permitted.',
  },
  {
    id: 'CN-0006',
    body: 'What does DNS primarily do?',
    topic: 'computer-networks',
    subtopic: 'http-dns',
    difficulty: 'easy',
    expectedSeconds: 35,
    roundTypes: TECH,
    options: [
      { body: 'Resolve human-readable domain names to IP addresses.', correct: true },
      { body: 'Encrypt traffic between browser and server.', whyWrong: 'That is TLS.' },
      { body: 'Assign IP addresses to hosts joining a network.', whyWrong: 'That is DHCP.' },
      { body: 'Route packets between autonomous systems.', whyWrong: 'That is BGP.' },
    ],
    explanation: 'DNS is a distributed, hierarchical directory that maps names such as example.com to IP addresses.',
  },

  // ══════════════════════════ Programming fundamentals ══════════════════════════
  {
    id: 'PRG-0001',
    body: 'What is the output?\n```c\nint x = 5;\nprintf("%d %d", x++, ++x);\n```',
    topic: 'programming-fundamentals',
    subtopic: 'output-prediction',
    difficulty: 'hard',
    expectedSeconds: 70,
    roundTypes: TECH,
    options: [
      { body: 'The behaviour is unspecified — argument evaluation order is not defined in C', correct: true },
      { body: '5 7', whyWrong: 'This assumes left-to-right evaluation, which the C standard does not guarantee.' },
      { body: '6 7', whyWrong: 'Again this assumes a particular evaluation order.' },
      { body: '5 6', whyWrong: 'This assumes an order the standard leaves open.' },
    ],
    explanation:
      'C does not specify the order in which function arguments are evaluated, and modifying x twice without an intervening sequence point is undefined behaviour. Different compilers legitimately print different results — this pattern should never appear in real code.',
    concept: 'Interview papers use this to test whether you recognise undefined behaviour rather than to test arithmetic.',
  },
  {
    id: 'PRG-0002',
    body: 'What does this pseudocode print?\n```\nSET a = 4\nSET b = 0\nWHILE a > 0 DO\n    b = b + a\n    a = a - 1\nEND WHILE\nPRINT b\n```',
    topic: 'programming-fundamentals',
    subtopic: 'output-prediction',
    difficulty: 'easy',
    expectedSeconds: 55,
    roundTypes: TECH_APT,
    frequentlyAsked: true,
    options: [
      { body: '10', correct: true },
      { body: '4', whyWrong: 'The loop accumulates every value from 4 down to 1, not just the first.' },
      { body: '0', whyWrong: 'b is incremented on each of the four iterations.' },
      { body: '6', whyWrong: 'That is 3 + 2 + 1 — the first iteration adds 4 as well.' },
    ],
    explanation: 'The loop adds 4 + 3 + 2 + 1 = 10 and stops when a reaches 0.',
  },
  {
    id: 'PRG-0003',
    body: 'What is the time complexity of this pseudocode?\n```\nFOR i = 1 TO n DO\n    j = 1\n    WHILE j < n DO\n        j = j * 2\n    END WHILE\nEND FOR\n```',
    topic: 'programming-fundamentals',
    subtopic: 'output-prediction',
    difficulty: 'medium',
    expectedSeconds: 65,
    roundTypes: TECH_APT,
    options: [
      { body: 'O(n log n)', correct: true },
      { body: 'O(n²)', whyWrong: 'The inner loop doubles j, so it runs log n times rather than n times.' },
      { body: 'O(n)', whyWrong: 'The inner loop still contributes a log n factor for each of the n outer iterations.' },
      { body: 'O(log n)', whyWrong: 'This ignores the outer loop that runs n times.' },
    ],
    explanation: 'The outer loop runs n times; the inner loop multiplies j by 2 until it reaches n, i.e. ⌈log₂ n⌉ iterations. Total: O(n log n).',
  },
  {
    id: 'PRG-0004',
    body: 'In C, what does the expression `sizeof(arr) / sizeof(arr[0])` compute for a locally declared array?',
    topic: 'programming-fundamentals',
    subtopic: 'pointers-memory',
    difficulty: 'medium',
    expectedSeconds: 55,
    roundTypes: TECH,
    options: [
      { body: 'The number of elements in the array', correct: true },
      { body: 'The number of bytes in the array', whyWrong: 'That is sizeof(arr) alone, before dividing by the element size.' },
      { body: 'The index of the last element', whyWrong: 'The last index is one less than the element count.' },
      { body: 'Always 1, because arrays decay to pointers', whyWrong: 'Decay happens when an array is passed to a function, not where it is declared.' },
    ],
    explanation:
      'For an array still in scope as an array, sizeof gives its total byte size, so dividing by one element’s size yields the element count. Inside a function that received it as a pointer, this idiom silently breaks.',
  },
  {
    id: 'PRG-0005',
    body: 'What is a memory leak?',
    topic: 'programming-fundamentals',
    subtopic: 'pointers-memory',
    difficulty: 'easy',
    expectedSeconds: 45,
    roundTypes: TECH,
    options: [
      {
        body: 'Heap memory that is no longer reachable but was never released back to the allocator.',
        correct: true,
      },
      { body: 'Reading past the end of an array.', whyWrong: 'That is a buffer overrun.' },
      { body: 'Dereferencing a pointer after the memory was freed.', whyWrong: 'That is a dangling-pointer or use-after-free bug.' },
      { body: 'Declaring more local variables than the stack can hold.', whyWrong: 'That is stack overflow.' },
    ],
    explanation:
      'A leak occurs when allocated memory becomes unreachable without being freed, so the process holds it until exit. Long-running services degrade as leaks accumulate.',
  },
  {
    id: 'PRG-0006',
    body: 'Which statement about pass-by-value and pass-by-reference is correct?',
    topic: 'programming-fundamentals',
    subtopic: 'pointers-memory',
    difficulty: 'medium',
    expectedSeconds: 55,
    roundTypes: TECH,
    options: [
      {
        body: 'Pass-by-value copies the argument, so the callee cannot change the caller’s variable itself.',
        correct: true,
      },
      {
        body: 'Pass-by-value is impossible for objects in any language.',
        whyWrong: 'Many languages copy objects by value, and object *references* are themselves passed by value in Java.',
      },
      {
        body: 'Pass-by-reference always copies the whole object.',
        whyWrong: 'Passing by reference avoids the copy — that is its main purpose.',
      },
      {
        body: 'Java passes objects by reference.',
        whyWrong: 'Java passes object *references* by value: reassigning the parameter does not affect the caller.',
      },
    ],
    explanation:
      'With pass-by-value the callee works on a copy, so assignments to the parameter are invisible to the caller. Java is strictly pass-by-value, though the value copied may be a reference — which is why mutating the pointed-to object is visible but reassigning is not.',
  },

  // ══════════════════════════ DSA theory ══════════════════════════
  {
    id: 'DSA-0001',
    body: 'What is the worst-case time complexity of QuickSort?',
    topic: 'sorting',
    difficulty: 'easy',
    expectedSeconds: 40,
    roundTypes: TECH,
    frequentlyAsked: true,
    options: [
      { body: 'O(n²)', correct: true },
      { body: 'O(n log n)', whyWrong: 'That is the average case; a pathological pivot choice degrades to quadratic.' },
      { body: 'O(log n)', whyWrong: 'No comparison sort can beat O(n log n), let alone reach O(log n).' },
      { body: 'O(n)', whyWrong: 'Only non-comparison sorts such as counting sort achieve linear time.' },
    ],
    explanation:
      'If the pivot is always the smallest or largest element (for instance, the first element of an already-sorted array), each partition removes just one element, giving n levels of O(n) work — O(n²). Randomised or median-of-three pivots make this vanishingly unlikely.',
  },
  {
    id: 'DSA-0002',
    body: 'Which data structure gives O(1) average-case insert, delete and lookup?',
    topic: 'hashing',
    difficulty: 'easy',
    expectedSeconds: 40,
    roundTypes: TECH,
    frequentlyAsked: true,
    options: [
      { body: 'Hash table', correct: true },
      { body: 'Balanced binary search tree', whyWrong: 'A balanced BST gives O(log n) for these operations.' },
      { body: 'Sorted array', whyWrong: 'Lookup is O(log n) and insertion is O(n) because of shifting.' },
      { body: 'Min-heap', whyWrong: 'A heap gives O(1) access to the minimum but O(log n) insert/delete and O(n) arbitrary lookup.' },
    ],
    explanation:
      'With a good hash function and bounded load factor, a hash table performs all three operations in O(1) expected time. Worst case degrades to O(n) when everything collides.',
  },
  {
    id: 'DSA-0003',
    body: 'Which traversal of a binary search tree visits nodes in ascending key order?',
    topic: 'trees',
    subtopic: 'tree-traversals',
    difficulty: 'easy',
    expectedSeconds: 40,
    roundTypes: TECH,
    frequentlyAsked: true,
    options: [
      { body: 'In-order', correct: true },
      { body: 'Pre-order', whyWrong: 'Pre-order visits the root before its subtrees, so it does not produce sorted output.' },
      { body: 'Post-order', whyWrong: 'Post-order visits the root last and is not sorted.' },
      { body: 'Level-order', whyWrong: 'Level-order follows breadth-first layers, unrelated to key order.' },
    ],
    explanation: 'In-order traversal (left, root, right) on a BST yields keys in ascending order — a common way to validate a BST.',
  },
  {
    id: 'DSA-0004',
    body: 'What is the time complexity of building a heap from an unsorted array of n elements using the standard bottom-up heapify?',
    topic: 'heaps',
    difficulty: 'hard',
    expectedSeconds: 65,
    roundTypes: TECH,
    options: [
      { body: 'O(n)', correct: true },
      { body: 'O(n log n)', whyWrong: 'That is the cost of inserting elements one at a time; bottom-up heapify is asymptotically cheaper.' },
      { body: 'O(log n)', whyWrong: 'Every element must be examined at least once.' },
      { body: 'O(n²)', whyWrong: 'Far too slow — each node sifts down at most its height.' },
    ],
    explanation:
      'Most nodes sit near the bottom and sift down only a little. Summing height × node-count across levels converges to O(n), not O(n log n).',
    concept: 'Σ (n/2^(h+1)) × h over all heights h converges to 2n.',
  },
  {
    id: 'DSA-0005',
    body: 'Which algorithm finds the shortest path in a weighted graph that may contain negative edge weights (but no negative cycles)?',
    topic: 'graphs',
    subtopic: 'shortest-paths',
    difficulty: 'medium',
    expectedSeconds: 60,
    roundTypes: TECH,
    frequentlyAsked: true,
    options: [
      { body: 'Bellman–Ford', correct: true },
      { body: 'Dijkstra', whyWrong: 'Dijkstra assumes non-negative weights; a negative edge can invalidate an already-finalised distance.' },
      { body: 'Breadth-first search', whyWrong: 'BFS finds shortest paths only in unweighted graphs (or uniform weights).' },
      { body: 'Kruskal', whyWrong: 'Kruskal builds a minimum spanning tree, not shortest paths.' },
    ],
    explanation:
      'Bellman–Ford relaxes every edge V − 1 times, which tolerates negative weights and detects negative cycles with one extra pass. It costs O(V·E) versus Dijkstra’s O((V + E) log V).',
  },
  {
    id: 'DSA-0006',
    body: 'Which traversal is used to produce a topological ordering of a DAG?',
    topic: 'graphs',
    subtopic: 'topological-sort',
    difficulty: 'medium',
    expectedSeconds: 55,
    roundTypes: TECH,
    options: [
      { body: 'Depth-first search with reverse post-order (or Kahn’s in-degree algorithm)', correct: true },
      { body: 'Breadth-first search from any node', whyWrong: 'Plain BFS from one node ignores in-degree constraints and may emit a node before its prerequisites.' },
      { body: 'In-order traversal', whyWrong: 'In-order traversal is defined for binary trees, not general graphs.' },
      { body: 'Prim’s algorithm', whyWrong: 'Prim builds a minimum spanning tree on an undirected graph.' },
    ],
    explanation:
      'Pushing each node onto a stack after exploring all its descendants and then popping gives a valid topological order. Kahn’s algorithm achieves the same by repeatedly removing zero in-degree nodes.',
  },
  {
    id: 'DSA-0007',
    body: 'What is the space complexity of the standard recursive merge sort on an array of n elements?',
    topic: 'sorting',
    difficulty: 'medium',
    expectedSeconds: 55,
    roundTypes: TECH,
    options: [
      { body: 'O(n)', correct: true },
      { body: 'O(1)', whyWrong: 'Standard merge sort needs an auxiliary buffer for merging; only sophisticated in-place variants approach O(1).' },
      { body: 'O(log n)', whyWrong: 'That is only the recursion-stack depth and ignores the merge buffer.' },
      { body: 'O(n log n)', whyWrong: 'The buffer is reused across levels, so it does not multiply by the depth.' },
    ],
    explanation:
      'Merging needs a temporary array proportional to the range being merged, so O(n) auxiliary space dominates the O(log n) recursion stack.',
  },
  {
    id: 'DSA-0008',
    body: 'Which problem is NOT naturally solved by dynamic programming?',
    topic: 'dynamic-programming',
    difficulty: 'medium',
    expectedSeconds: 60,
    roundTypes: TECH,
    options: [
      { body: 'Finding a minimum spanning tree', correct: true },
      { body: 'Longest common subsequence', whyWrong: 'LCS is a textbook DP with overlapping subproblems on prefix pairs.' },
      { body: '0/1 knapsack', whyWrong: 'Knapsack is the canonical DP over capacity and item index.' },
      { body: 'Edit distance', whyWrong: 'Edit distance is a standard two-dimensional DP.' },
    ],
    explanation:
      'MST is solved greedily (Kruskal or Prim) because the cut property guarantees a locally optimal edge is globally safe. It lacks the overlapping-subproblem structure DP exploits.',
  },
  {
    id: 'DSA-0009',
    body: 'For a singly linked list, what is the time complexity of deleting a node given only a pointer to that node (not the head), assuming it is not the tail?',
    topic: 'linked-lists',
    difficulty: 'medium',
    expectedSeconds: 65,
    roundTypes: TECH,
    frequentlyAsked: true,
    options: [
      { body: 'O(1) by copying the next node’s data and unlinking the next node', correct: true },
      { body: 'O(n) because you must find the previous node', whyWrong: 'The copy trick avoids needing the predecessor entirely.' },
      { body: 'Impossible without the head pointer', whyWrong: 'It is possible for any non-tail node via the copy trick.' },
      { body: 'O(log n)', whyWrong: 'Linked lists offer no logarithmic access path.' },
    ],
    explanation:
      'Copy the successor’s value into the current node and then splice out the successor. This fails for the tail, since there is no successor to copy from.',
  },
  {
    id: 'DSA-0010',
    body: 'Which data structure is best for implementing an LRU cache with O(1) get and put?',
    topic: 'hashing',
    difficulty: 'hard',
    expectedSeconds: 70,
    roundTypes: TECH,
    frequentlyAsked: true,
    options: [
      { body: 'Hash map plus doubly linked list', correct: true },
      { body: 'Min-heap keyed by access time', whyWrong: 'Heap updates cost O(log n), so get and put are not O(1).' },
      { body: 'Sorted array by recency', whyWrong: 'Maintaining sort order on access costs O(n) per operation.' },
      { body: 'Single hash map only', whyWrong: 'A hash map alone cannot tell you which key is least recently used.' },
    ],
    explanation:
      'The hash map gives O(1) lookup to a list node; the doubly linked list gives O(1) unlink and move-to-front, so recency is maintained without scanning.',
  },
  {
    id: 'DSA-0011',
    body: 'What is the minimum number of comparisons needed to find both the maximum and minimum of n elements?',
    topic: 'complexity-analysis',
    difficulty: 'hard',
    expectedSeconds: 75,
    roundTypes: TECH,
    options: [
      { body: 'About 3n/2', correct: true },
      { body: '2n', whyWrong: 'That is the naive approach of two independent scans; pairing elements does better.' },
      { body: 'n log n', whyWrong: 'Sorting is unnecessary for finding just the extremes.' },
      { body: 'n', whyWrong: 'A single comparison per element cannot maintain both extremes.' },
    ],
    explanation:
      'Compare elements in pairs first (n/2 comparisons), then compare the smaller of each pair against the running minimum and the larger against the running maximum (n/2 each). Total ≈ 3n/2 − 2.',
  },
  {
    id: 'DSA-0012',
    body: 'Binary search on a sorted array of 1,000,000 elements needs at most how many comparisons?',
    topic: 'searching',
    subtopic: 'binary-search',
    difficulty: 'easy',
    expectedSeconds: 50,
    roundTypes: TECH_APT,
    options: [
      { body: 'About 20', correct: true },
      { body: 'About 1,000', whyWrong: 'That is √n, the cost of jump search rather than binary search.' },
      { body: 'About 100', whyWrong: 'Recall that log₂(10⁶) ≈ 20.' },
      { body: 'About 1,000,000', whyWrong: 'That is linear search.' },
    ],
    explanation: 'Binary search halves the range each step, needing ⌈log₂(10⁶)⌉ ≈ 20 comparisons.',
  },
  {
    id: 'DSA-0013',
    body: 'Which of these is a stable sorting algorithm?',
    topic: 'sorting',
    difficulty: 'medium',
    expectedSeconds: 50,
    roundTypes: TECH,
    options: [
      { body: 'Merge sort', correct: true },
      { body: 'QuickSort (typical in-place implementation)', whyWrong: 'Standard in-place partitioning swaps distant elements and does not preserve the relative order of equal keys.' },
      { body: 'Heap sort', whyWrong: 'Heap sort’s sift operations reorder equal keys arbitrarily.' },
      { body: 'Selection sort', whyWrong: 'Selection sort swaps a minimum into place across the array, which can reorder equal keys.' },
    ],
    explanation:
      'Merge sort is stable when the merge step prefers the left run on ties. Stability matters when sorting by several keys in sequence.',
  },
  {
    id: 'DSA-0014',
    body: 'A stack is used to check balanced parentheses. Which input causes the algorithm to report "unbalanced" only at the end of the scan?',
    topic: 'stacks-queues',
    difficulty: 'medium',
    expectedSeconds: 60,
    roundTypes: TECH,
    options: [
      { body: '"((()"', correct: true },
      { body: '"())"', whyWrong: 'The third character pops an empty stack, so the failure is detected mid-scan.' },
      { body: '"()]"', whyWrong: 'The mismatched closer is caught immediately when it appears.' },
      { body: '"(()())"', whyWrong: 'This string is balanced.' },
    ],
    explanation:
      'Unmatched *openers* are only discovered when the scan ends and the stack is non-empty. Unmatched closers, by contrast, fail as soon as they are read.',
  },
  {
    id: 'DSA-0015',
    body: 'What is the time complexity of finding whether a cycle exists in an undirected graph using DFS?',
    topic: 'graphs',
    subtopic: 'bfs-dfs',
    difficulty: 'medium',
    expectedSeconds: 55,
    roundTypes: TECH,
    options: [
      { body: 'O(V + E)', correct: true },
      { body: 'O(V²) regardless of representation', whyWrong: 'That is only true for an adjacency-matrix representation; with adjacency lists it is O(V + E).' },
      { body: 'O(E log V)', whyWrong: 'That resembles Kruskal’s sorting cost, not a plain DFS.' },
      { body: 'O(V·E)', whyWrong: 'That is Bellman–Ford territory.' },
    ],
    explanation: 'DFS visits each vertex once and traverses each edge at most twice on adjacency lists, giving O(V + E).',
  },

  // ══════════════════════════ System design ══════════════════════════
  {
    id: 'SD-0001',
    body: 'What is the main purpose of a load balancer?',
    topic: 'system-design-basics',
    subtopic: 'scalability',
    difficulty: 'easy',
    expectedSeconds: 45,
    roundTypes: DESIGN,
    options: [
      { body: 'Distribute incoming requests across multiple servers and route around unhealthy ones.', correct: true },
      { body: 'Store frequently accessed data close to the client.', whyWrong: 'That is a cache or CDN.' },
      { body: 'Split a database table across multiple machines.', whyWrong: 'That is sharding.' },
      { body: 'Compress responses to save bandwidth.', whyWrong: 'Compression is a transport optimisation, not load balancing.' },
    ],
    explanation:
      'A load balancer spreads traffic across a pool of servers, performs health checks and enables horizontal scaling plus zero-downtime deploys.',
  },
  {
    id: 'SD-0002',
    body: 'Which caching strategy writes to the cache and the database at the same time?',
    topic: 'system-design-basics',
    subtopic: 'caching',
    difficulty: 'medium',
    expectedSeconds: 55,
    roundTypes: DESIGN,
    options: [
      { body: 'Write-through', correct: true },
      { body: 'Write-back', whyWrong: 'Write-back updates the cache first and flushes to the database later, risking loss on failure.' },
      { body: 'Cache-aside', whyWrong: 'Cache-aside has the application populate the cache only on a read miss.' },
      { body: 'Write-around', whyWrong: 'Write-around bypasses the cache on writes entirely.' },
    ],
    explanation:
      'Write-through keeps cache and store consistent by writing both synchronously, at the cost of higher write latency.',
  },
  {
    id: 'SD-0003',
    body: 'In the CAP theorem, what must a distributed system sacrifice during a network partition?',
    topic: 'system-design-basics',
    subtopic: 'db-sharding',
    difficulty: 'hard',
    expectedSeconds: 70,
    roundTypes: DESIGN,
    options: [
      { body: 'Either consistency or availability', correct: true },
      { body: 'Partition tolerance', whyWrong: 'Partitions are a fact of networks, not a property you can choose to drop.' },
      { body: 'Durability', whyWrong: 'Durability is an ACID property and is not part of CAP.' },
      { body: 'Nothing — all three are achievable', whyWrong: 'CAP states precisely that all three cannot hold simultaneously during a partition.' },
    ],
    explanation:
      'When the network partitions, a system either refuses requests to stay consistent (CP) or serves possibly stale data to stay available (AP). Partition tolerance is not optional in a real network.',
  },
  {
    id: 'SD-0004',
    body: 'Which HTTP method should be idempotent according to REST conventions?',
    topic: 'system-design-basics',
    subtopic: 'api-design',
    difficulty: 'medium',
    expectedSeconds: 50,
    roundTypes: DESIGN,
    options: [
      { body: 'PUT', correct: true },
      { body: 'POST', whyWrong: 'POST typically creates a new resource each time, so repeating it has additional effects.' },
      { body: 'PATCH', whyWrong: 'PATCH is not required to be idempotent — it depends on the patch semantics.' },
      { body: 'CONNECT', whyWrong: 'CONNECT establishes a tunnel and is not part of resource-manipulation semantics.' },
    ],
    explanation:
      'PUT replaces a resource with the supplied representation, so issuing it repeatedly leaves the same final state. GET, HEAD and DELETE are also idempotent; POST is not.',
  },
];
