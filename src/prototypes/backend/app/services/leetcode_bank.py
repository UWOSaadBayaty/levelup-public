from typing import List, Dict, Any, Tuple

# Blind 75 + selected NeetCode extras, tagged for matching.
_PROBLEMS: List[Dict[str, Any]] = [
    # Arrays & Hashing
    {"title": "Two Sum", "slug": "two-sum", "tags": ["arrays", "hashmap"]},
    {"title": "Contains Duplicate", "slug": "contains-duplicate", "tags": ["arrays", "hashmap"]},
    {"title": "Valid Anagram", "slug": "valid-anagram", "tags": ["string", "hashmap", "sorting"]},
    {"title": "Group Anagrams", "slug": "group-anagrams", "tags": ["string", "hashmap"]},
    {"title": "Top K Frequent Elements", "slug": "top-k-frequent-elements", "tags": ["heap", "hashmap"]},
    {"title": "Product of Array Except Self", "slug": "product-of-array-except-self", "tags": ["arrays", "prefix-sum"]},
    {"title": "Valid Sudoku", "slug": "valid-sudoku", "tags": ["arrays", "hashmap", "matrix"]},
    {"title": "Encode and Decode Strings", "slug": "encode-and-decode-strings", "tags": ["string", "arrays"]},
    {"title": "Longest Consecutive Sequence", "slug": "longest-consecutive-sequence", "tags": ["arrays", "hashmap"]},

    # Two Pointers
    {"title": "Valid Palindrome", "slug": "valid-palindrome", "tags": ["two-pointers", "string"]},
    {"title": "Two Sum II", "slug": "two-sum-ii-input-array-is-sorted", "tags": ["two-pointers", "arrays", "binary-search"]},
    {"title": "3Sum", "slug": "3sum", "tags": ["two-pointers", "arrays", "sorting"]},
    {"title": "Container With Most Water", "slug": "container-with-most-water", "tags": ["two-pointers", "arrays"]},
    {"title": "Trapping Rain Water", "slug": "trapping-rain-water", "tags": ["two-pointers", "arrays", "stack"]},

    # Sliding Window
    {"title": "Longest Substring Without Repeating Characters", "slug": "longest-substring-without-repeating-characters", "tags": ["sliding-window", "string", "hashmap"]},
    {"title": "Longest Repeating Character Replacement", "slug": "longest-repeating-character-replacement", "tags": ["sliding-window", "string"]},
    {"title": "Minimum Window Substring", "slug": "minimum-window-substring", "tags": ["sliding-window", "string", "hashmap"]},
    {"title": "Permutation in String", "slug": "permutation-in-string", "tags": ["sliding-window", "string", "hashmap"]},

    # Stack
    {"title": "Valid Parentheses", "slug": "valid-parentheses", "tags": ["stack", "string"]},
    {"title": "Min Stack", "slug": "min-stack", "tags": ["stack"]},
    {"title": "Evaluate Reverse Polish Notation", "slug": "evaluate-reverse-polish-notation", "tags": ["stack", "arrays"]},
    {"title": "Generate Parentheses", "slug": "generate-parentheses", "tags": ["stack", "recursion", "backtracking"]},
    {"title": "Daily Temperatures", "slug": "daily-temperatures", "tags": ["stack", "monotonic-stack", "arrays"]},
    {"title": "Car Fleet", "slug": "car-fleet", "tags": ["stack", "monotonic-stack", "sorting"]},
    {"title": "Largest Rectangle in Histogram", "slug": "largest-rectangle-in-histogram", "tags": ["stack", "monotonic-stack", "arrays"]},

    # Binary Search
    {"title": "Binary Search", "slug": "binary-search", "tags": ["binary-search", "arrays"]},
    {"title": "Search a 2D Matrix", "slug": "search-a-2d-matrix", "tags": ["binary-search", "matrix"]},
    {"title": "Koko Eating Bananas", "slug": "koko-eating-bananas", "tags": ["binary-search", "arrays"]},
    {"title": "Search in Rotated Sorted Array", "slug": "search-in-rotated-sorted-array", "tags": ["binary-search", "arrays"]},
    {"title": "Find Minimum in Rotated Sorted Array", "slug": "find-minimum-in-rotated-sorted-array", "tags": ["binary-search", "arrays"]},
    {"title": "Time Based Key-Value Store", "slug": "time-based-key-value-store", "tags": ["binary-search", "hashmap", "design"]},
    {"title": "Median of Two Sorted Arrays", "slug": "median-of-two-sorted-arrays", "tags": ["binary-search", "arrays"]},

    # Linked List
    {"title": "Reverse Linked List", "slug": "reverse-linked-list", "tags": ["linked-list", "recursion"]},
    {"title": "Merge Two Sorted Lists", "slug": "merge-two-sorted-lists", "tags": ["linked-list", "recursion"]},
    {"title": "Reorder List", "slug": "reorder-list", "tags": ["linked-list", "two-pointers"]},
    {"title": "Remove Nth Node From End of List", "slug": "remove-nth-node-from-end-of-list", "tags": ["linked-list", "two-pointers"]},
    {"title": "Copy List with Random Pointer", "slug": "copy-list-with-random-pointer", "tags": ["linked-list", "hashmap"]},
    {"title": "Add Two Numbers", "slug": "add-two-numbers", "tags": ["linked-list", "recursion"]},
    {"title": "Linked List Cycle", "slug": "linked-list-cycle", "tags": ["linked-list", "two-pointers"]},
    {"title": "LRU Cache", "slug": "lru-cache", "tags": ["linked-list", "hashmap", "design", "caching"]},
    {"title": "Merge K Sorted Lists", "slug": "merge-k-sorted-lists", "tags": ["linked-list", "heap", "divide-and-conquer"]},
    {"title": "Reverse Nodes in k-Group", "slug": "reverse-nodes-in-k-group", "tags": ["linked-list", "recursion"]},

    # Trees
    {"title": "Invert Binary Tree", "slug": "invert-binary-tree", "tags": ["trees", "dfs", "bfs", "recursion"]},
    {"title": "Maximum Depth of Binary Tree", "slug": "maximum-depth-of-binary-tree", "tags": ["trees", "dfs", "recursion"]},
    {"title": "Diameter of Binary Tree", "slug": "diameter-of-binary-tree", "tags": ["trees", "dfs"]},
    {"title": "Balanced Binary Tree", "slug": "balanced-binary-tree", "tags": ["trees", "dfs"]},
    {"title": "Same Tree", "slug": "same-tree", "tags": ["trees", "dfs", "recursion"]},
    {"title": "Subtree of Another Tree", "slug": "subtree-of-another-tree", "tags": ["trees", "dfs", "recursion"]},
    {"title": "Lowest Common Ancestor of a Binary Search Tree", "slug": "lowest-common-ancestor-of-a-binary-search-tree", "tags": ["trees", "bst", "dfs"]},
    {"title": "Binary Tree Level Order Traversal", "slug": "binary-tree-level-order-traversal", "tags": ["trees", "bfs"]},
    {"title": "Binary Tree Right Side View", "slug": "binary-tree-right-side-view", "tags": ["trees", "bfs", "dfs"]},
    {"title": "Count Good Nodes in Binary Tree", "slug": "count-good-nodes-in-binary-tree", "tags": ["trees", "dfs"]},
    {"title": "Validate Binary Search Tree", "slug": "validate-binary-search-tree", "tags": ["trees", "bst", "dfs"]},
    {"title": "Kth Smallest Element in a BST", "slug": "kth-smallest-element-in-a-bst", "tags": ["trees", "bst", "dfs"]},
    {"title": "Lowest Common Ancestor of a Binary Tree", "slug": "lowest-common-ancestor-of-a-binary-tree", "tags": ["trees", "dfs"]},
    {"title": "Binary Tree Maximum Path Sum", "slug": "binary-tree-maximum-path-sum", "tags": ["trees", "dfs", "dp"]},
    {"title": "Serialize and Deserialize Binary Tree", "slug": "serialize-and-deserialize-binary-tree", "tags": ["trees", "bfs", "dfs", "design"]},
    {"title": "Construct Binary Tree from Preorder and Inorder Traversal", "slug": "construct-binary-tree-from-preorder-and-inorder-traversal", "tags": ["trees", "dfs", "divide-and-conquer"]},

    # Tries
    {"title": "Implement Trie (Prefix Tree)", "slug": "implement-trie-prefix-tree", "tags": ["trie", "design", "string"]},
    {"title": "Design Add and Search Words Data Structure", "slug": "design-add-and-search-words-data-structure", "tags": ["trie", "design", "string", "dfs"]},
    {"title": "Word Search II", "slug": "word-search-ii", "tags": ["trie", "backtracking", "graphs"]},

    # Heap / Priority Queue
    {"title": "Kth Largest Element in a Stream", "slug": "kth-largest-element-in-a-stream", "tags": ["heap", "design"]},
    {"title": "Last Stone Weight", "slug": "last-stone-weight", "tags": ["heap", "arrays"]},
    {"title": "K Closest Points to Origin", "slug": "k-closest-points-to-origin", "tags": ["heap", "sorting", "arrays"]},
    {"title": "Task Scheduler", "slug": "task-scheduler", "tags": ["heap", "greedy", "arrays"]},
    {"title": "Design Twitter", "slug": "design-twitter", "tags": ["heap", "design", "hashmap"]},
    {"title": "Find Median from Data Stream", "slug": "find-median-from-data-stream", "tags": ["heap", "design", "two-pointers"]},

    # Graphs
    {"title": "Number of Islands", "slug": "number-of-islands", "tags": ["graphs", "dfs", "bfs", "matrix"]},
    {"title": "Clone Graph", "slug": "clone-graph", "tags": ["graphs", "dfs", "bfs", "hashmap"]},
    {"title": "Max Area of Island", "slug": "max-area-of-island", "tags": ["graphs", "dfs", "bfs", "matrix"]},
    {"title": "Pacific Atlantic Water Flow", "slug": "pacific-atlantic-water-flow", "tags": ["graphs", "dfs", "bfs", "matrix"]},
    {"title": "Surrounded Regions", "slug": "surrounded-regions", "tags": ["graphs", "dfs", "bfs", "matrix"]},
    {"title": "Rotting Oranges", "slug": "rotting-oranges", "tags": ["graphs", "bfs", "matrix"]},
    {"title": "Walls and Gates", "slug": "walls-and-gates", "tags": ["graphs", "bfs", "matrix"]},
    {"title": "Course Schedule", "slug": "course-schedule", "tags": ["graphs", "topological-sort", "dfs"]},
    {"title": "Course Schedule II", "slug": "course-schedule-ii", "tags": ["graphs", "topological-sort", "dfs"]},
    {"title": "Redundant Connection", "slug": "redundant-connection", "tags": ["graphs", "union-find"]},
    {"title": "Number of Connected Components in an Undirected Graph", "slug": "number-of-connected-components-in-an-undirected-graph", "tags": ["graphs", "union-find", "dfs"]},
    {"title": "Graph Valid Tree", "slug": "graph-valid-tree", "tags": ["graphs", "union-find", "dfs"]},
    {"title": "Word Ladder", "slug": "word-ladder", "tags": ["graphs", "bfs", "string"]},

    # Dynamic Programming 1D
    {"title": "Climbing Stairs", "slug": "climbing-stairs", "tags": ["dp", "recursion"]},
    {"title": "Min Cost Climbing Stairs", "slug": "min-cost-climbing-stairs", "tags": ["dp", "arrays"]},
    {"title": "House Robber", "slug": "house-robber", "tags": ["dp", "arrays"]},
    {"title": "House Robber II", "slug": "house-robber-ii", "tags": ["dp", "arrays"]},
    {"title": "Longest Palindromic Substring", "slug": "longest-palindromic-substring", "tags": ["dp", "string", "two-pointers"]},
    {"title": "Palindromic Substrings", "slug": "palindromic-substrings", "tags": ["dp", "string", "two-pointers"]},
    {"title": "Decode Ways", "slug": "decode-ways", "tags": ["dp", "string"]},
    {"title": "Coin Change", "slug": "coin-change", "tags": ["dp", "arrays"]},
    {"title": "Maximum Product Subarray", "slug": "maximum-product-subarray", "tags": ["dp", "arrays"]},
    {"title": "Word Break", "slug": "word-break", "tags": ["dp", "string", "hashmap"]},
    {"title": "Longest Increasing Subsequence", "slug": "longest-increasing-subsequence", "tags": ["dp", "arrays", "binary-search"]},
    {"title": "Partition Equal Subset Sum", "slug": "partition-equal-subset-sum", "tags": ["dp", "arrays"]},

    # Dynamic Programming 2D
    {"title": "Unique Paths", "slug": "unique-paths", "tags": ["dp", "matrix"]},
    {"title": "Longest Common Subsequence", "slug": "longest-common-subsequence", "tags": ["dp", "string"]},
    {"title": "Best Time to Buy and Sell Stock with Cooldown", "slug": "best-time-to-buy-and-sell-stock-with-cooldown", "tags": ["dp", "arrays"]},
    {"title": "Coin Change II", "slug": "coin-change-ii", "tags": ["dp", "arrays"]},
    {"title": "Target Sum", "slug": "target-sum", "tags": ["dp", "arrays", "backtracking"]},
    {"title": "Interleaving String", "slug": "interleaving-string", "tags": ["dp", "string"]},
    {"title": "Edit Distance", "slug": "edit-distance", "tags": ["dp", "string"]},
    {"title": "Burst Balloons", "slug": "burst-balloons", "tags": ["dp", "divide-and-conquer"]},
    {"title": "Regular Expression Matching", "slug": "regular-expression-matching", "tags": ["dp", "string", "recursion"]},

    # Greedy
    {"title": "Maximum Subarray", "slug": "maximum-subarray", "tags": ["dp", "greedy", "arrays", "divide-and-conquer"]},
    {"title": "Jump Game", "slug": "jump-game", "tags": ["greedy", "arrays", "dp"]},
    {"title": "Jump Game II", "slug": "jump-game-ii", "tags": ["greedy", "arrays", "dp"]},
    {"title": "Gas Station", "slug": "gas-station", "tags": ["greedy", "arrays"]},
    {"title": "Hand of Straights", "slug": "hand-of-straights", "tags": ["greedy", "sorting", "hashmap"]},
    {"title": "Merge Triplets to Form Target Triplet", "slug": "merge-triplets-to-form-target-triplet", "tags": ["greedy", "arrays"]},
    {"title": "Partition Labels", "slug": "partition-labels", "tags": ["greedy", "string", "two-pointers"]},
    {"title": "Valid Parenthesis String", "slug": "valid-parenthesis-string", "tags": ["greedy", "string", "dp"]},

    # Intervals
    {"title": "Insert Interval", "slug": "insert-interval", "tags": ["intervals", "arrays"]},
    {"title": "Merge Intervals", "slug": "merge-intervals", "tags": ["intervals", "sorting", "arrays"]},
    {"title": "Non-overlapping Intervals", "slug": "non-overlapping-intervals", "tags": ["intervals", "greedy", "sorting"]},
    {"title": "Meeting Rooms", "slug": "meeting-rooms", "tags": ["intervals", "sorting"]},
    {"title": "Meeting Rooms II", "slug": "meeting-rooms-ii", "tags": ["intervals", "sorting", "heap"]},
    {"title": "Minimum Interval to Include Each Query", "slug": "minimum-interval-to-include-each-query", "tags": ["intervals", "sorting", "heap", "binary-search"]},

    # Math & Geometry
    {"title": "Rotate Image", "slug": "rotate-image", "tags": ["matrix", "arrays", "math"]},
    {"title": "Spiral Matrix", "slug": "spiral-matrix", "tags": ["matrix", "arrays"]},
    {"title": "Set Matrix Zeroes", "slug": "set-matrix-zeroes", "tags": ["matrix", "arrays"]},
    {"title": "Happy Number", "slug": "happy-number", "tags": ["math", "hashmap", "two-pointers"]},
    {"title": "Plus One", "slug": "plus-one", "tags": ["math", "arrays"]},
    {"title": "Pow(x, n)", "slug": "powx-n", "tags": ["math", "recursion", "binary-search"]},
    {"title": "Multiply Strings", "slug": "multiply-strings", "tags": ["math", "string"]},
    {"title": "Detect Squares", "slug": "detect-squares", "tags": ["math", "hashmap", "design"]},

    # Bit Manipulation
    {"title": "Single Number", "slug": "single-number", "tags": ["bit-manipulation", "arrays"]},
    {"title": "Number of 1 Bits", "slug": "number-of-1-bits", "tags": ["bit-manipulation"]},
    {"title": "Counting Bits", "slug": "counting-bits", "tags": ["bit-manipulation", "dp"]},
    {"title": "Reverse Bits", "slug": "reverse-bits", "tags": ["bit-manipulation"]},
    {"title": "Missing Number", "slug": "missing-number", "tags": ["bit-manipulation", "arrays", "math"]},
    {"title": "Sum of Two Integers", "slug": "sum-of-two-integers", "tags": ["bit-manipulation", "math"]},
    {"title": "Reverse Integer", "slug": "reverse-integer", "tags": ["bit-manipulation", "math"]},

    # Backtracking
    {"title": "Subsets", "slug": "subsets", "tags": ["backtracking", "arrays", "recursion"]},
    {"title": "Combination Sum", "slug": "combination-sum", "tags": ["backtracking", "arrays", "recursion"]},
    {"title": "Combination Sum II", "slug": "combination-sum-ii", "tags": ["backtracking", "arrays"]},
    {"title": "Permutations", "slug": "permutations", "tags": ["backtracking", "arrays", "recursion"]},
    {"title": "Subsets II", "slug": "subsets-ii", "tags": ["backtracking", "arrays", "sorting"]},
    {"title": "Word Search", "slug": "word-search", "tags": ["backtracking", "graphs", "matrix", "dfs"]},
    {"title": "Palindrome Partitioning", "slug": "palindrome-partitioning", "tags": ["backtracking", "dp", "string"]},
    {"title": "Letter Combinations of a Phone Number", "slug": "letter-combinations-of-a-phone-number", "tags": ["backtracking", "string", "recursion"]},
    {"title": "N-Queens", "slug": "n-queens", "tags": ["backtracking", "recursion"]},

    # SQL
    {"title": "Combine Two Tables", "slug": "combine-two-tables", "tags": ["sql", "database"]},
    {"title": "Second Highest Salary", "slug": "second-highest-salary", "tags": ["sql", "database"]},
    {"title": "Rank Scores", "slug": "rank-scores", "tags": ["sql", "database"]},
    {"title": "Consecutive Numbers", "slug": "consecutive-numbers", "tags": ["sql", "database"]},
    {"title": "Employees Earning More Than Their Managers", "slug": "employees-earning-more-than-their-managers", "tags": ["sql", "database"]},
    {"title": "Duplicate Emails", "slug": "duplicate-emails", "tags": ["sql", "database"]},
    {"title": "Department Top Three Salaries", "slug": "department-top-three-salaries", "tags": ["sql", "database"]},

    # System Design (linked to relevant LeetCode design problems)
    {"title": "LRU Cache", "slug": "lru-cache", "tags": ["system-design", "design", "caching", "hashmap", "linked-list"]},
    {"title": "Design Twitter", "slug": "design-twitter", "tags": ["system-design", "design", "heap", "hashmap"]},
    {"title": "Design In-Memory File System", "slug": "design-in-memory-file-system", "tags": ["system-design", "design", "trie"]},
    {"title": "Design Hit Counter", "slug": "design-hit-counter", "tags": ["system-design", "design", "queue"]},
    {"title": "Serialize and Deserialize Binary Tree", "slug": "serialize-and-deserialize-binary-tree", "tags": ["system-design", "design", "trees"]},
    {"title": "Find Median from Data Stream", "slug": "find-median-from-data-stream", "tags": ["system-design", "design", "heap"]},
    {"title": "Time Based Key-Value Store", "slug": "time-based-key-value-store", "tags": ["system-design", "design", "binary-search", "hashmap"]},
]


def _score_match(problem_tags: List[str], target_tags: List[str]) -> int:
    p = set(t.lower().strip() for t in problem_tags)
    t = set(x.lower().strip() for x in target_tags)
    return len(p.intersection(t))


def pick_leetcode_links(tags: List[str], k: int = 5) -> List[Dict[str, str]]:
    if not tags:
        return []

    scored: List[Tuple[int, Dict[str, Any]]] = []
    for prob in _PROBLEMS:
        score = _score_match(prob["tags"], tags)
        if score > 0:
            scored.append((score, prob))

    # Sort by match score descending, deduplicate by slug
    scored.sort(key=lambda x: x[0], reverse=True)
    seen = set()
    top = []
    for _, prob in scored:
        if prob["slug"] not in seen:
            seen.add(prob["slug"])
            top.append(prob)
        if len(top) == k:
            break

    return [
        {"title": prob["title"], "url": f"https://leetcode.com/problems/{prob['slug']}/"}
        for prob in top
    ]
