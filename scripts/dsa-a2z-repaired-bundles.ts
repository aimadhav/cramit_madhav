export type RepairedCard = { front: string; back: string };

export type RepairedBundle = {
  original_id: string;
  title: string;
  difficulty: string;
  tags: string[];
  repaired: true;
  parent: RepairedCard;
  children: RepairedCard[];
};

// These bundles are reconstructed from the matching GFG problem descriptions.
// They intentionally use the same parent/child shape as flashcards_db.json.
export const repairedBundles: RepairedBundle[] = [
  {
    original_id: 'kktingbnns', title: 'Koko Eating Bananas', difficulty: 'Medium', tags: ['Binary Search', 'Arrays'], repaired: true,
    parent: { front: 'Koko Eating Bananas: find the minimum eating speed s that finishes every pile within k hours.', back: 'For a candidate speed s, a pile of size p takes ceil(p / s) hours. The total hours must be at most k. The answer is the smallest feasible speed, found by binary-searching the answer range from 1 to the largest pile.' },
    children: [
      { front: 'What is the binary-search search space?', back: 'The speed is between 1 and max(arr). At max(arr), every pile takes at most one hour, so the upper bound is always feasible when the input guarantees a solution.' },
      { front: 'How do you calculate the hours needed for a speed s?', back: 'Sum ceil(p / s) for every pile p. With integer arithmetic, ceil(p / s) is (p + s - 1) / s.' },
      { front: 'What monotonic property enables binary search?', back: 'If speed s can finish within k hours, every faster speed can also finish. If s is too slow, every slower speed is also too slow.' },
      { front: 'What is the time and space complexity?', back: 'Each feasibility check is O(n), and binary search performs O(log(max pile)) checks. Total time is O(n log M), with O(1) extra space.' },
      { front: 'Write the core pseudocode for Koko Eating Bananas.', back: 'low = 1, high = max(arr)\nwhile low < high:\n  mid = (low + high) // 2\n  if sum(ceil(p / mid) for p in arr) <= k: high = mid\n  else: low = mid + 1\nreturn low' },
    ],
  },
  {
    original_id: 'findthnmbrthtpprsddnmbrftims', title: 'One odd Occuring', difficulty: 'Basic', tags: ['Arrays', 'Hash', 'Bit Magic', 'Data Structures'], repaired: true,
    parent: { front: 'Find the number that occurs an odd number of times when every other array value occurs an even number of times.', back: 'XOR every element. Equal values cancel because x ^ x = 0, and 0 ^ x = x. Therefore the final XOR is exactly the value occurring an odd number of times.' },
    children: [
      { front: 'Why does XOR solve this problem?', back: 'XOR is commutative and associative, and a value XORed with itself becomes zero. Every even-frequency value cancels out, leaving the odd-frequency value.' },
      { front: 'What is the time and space complexity?', back: 'Time is O(n) because the array is scanned once. Extra space is O(1), unlike a frequency map.' },
      { front: 'Does the method require the odd value to occur exactly once?', back: 'No. It works whenever exactly one value has odd frequency and all other values have even frequency, whether the odd value occurs once, three times, or more.' },
      { front: 'What happens if two values occur an odd number of times?', back: 'A single XOR result cannot identify both values. The stated constraint of exactly one odd-frequency value is required for this solution.' },
      { front: 'Write the pseudocode.', back: 'answer = 0\nfor value in arr:\n  answer = answer XOR value\nreturn answer' },
    ],
  },
  {
    original_id: 'nxtgrtrlmnt2', title: 'Next Greater Element', difficulty: 'Medium', tags: ['Stack', 'Data Structures'], repaired: true,
    parent: { front: 'For every array element, find the nearest element to its right that is strictly greater; return -1 if none exists.', back: 'Scan from right to left with a monotonic decreasing stack. Remove stack values that are not greater than the current value. The remaining top is the next greater element; then push the current value.' },
    children: [
      { front: 'What does the stack contain?', back: 'It contains candidates for next greater elements in decreasing order from the top perspective. Values that cannot help a future element are removed.' },
      { front: 'Why scan from right to left?', back: 'When processing arr[i], every possible answer lies to its right. Scanning backward makes those candidates available in the stack already.' },
      { front: 'What is the pop condition?', back: 'Pop while the stack is not empty and stack.top <= arr[i]. The answer must be strictly greater, so equal values cannot remain as answers.' },
      { front: 'What is the complexity?', back: 'Every element is pushed once and popped at most once. Time is O(n) and extra space is O(n).' },
      { front: 'Write the pseudocode.', back: 'stack = empty, answer = array of -1\nfor i from n - 1 down to 0:\n  while stack not empty and stack.top <= arr[i]: pop\n  if stack not empty: answer[i] = stack.top\n  push arr[i]\nreturn answer' },
    ],
  },
  {
    original_id: 'trppingrinwtr', title: 'Trapping Rain Water', difficulty: 'Hard', tags: ['Arrays', 'Data Structures', 'Algorithms', 'Stack', 'two-pointer-algorithm'], repaired: true,
    parent: { front: 'Given block heights with width 1, calculate the total amount of rainwater trapped between the blocks.', back: 'Water above a position is bounded by the shorter of the tallest wall to its left and right, minus its own height. A two-pointer scan maintains leftMax and rightMax and processes the side with the smaller current height.' },
    children: [
      { front: 'What is the formula for water above index i?', back: 'water[i] = max(0, min(leftMax[i], rightMax[i]) - arr[i]). The two-pointer method computes this without storing both auxiliary arrays.' },
      { front: 'Why can the lower-height pointer be processed safely?', back: 'If height[left] <= height[right], the left side is the limiting boundary, so leftMax determines the water at the left pointer. The symmetric argument applies on the right.' },
      { front: 'What happens at a boundary or a monotonic array?', back: 'There is no wall on both sides of boundary positions, and a monotonic array has no enclosed basin, so the trapped amount is zero there.' },
      { front: 'What is the complexity of the two-pointer solution?', back: 'Time is O(n) and extra space is O(1). Prefix/suffix maxima also take O(n) time but use O(n) space.' },
      { front: 'Write the two-pointer pseudocode.', back: 'left = 0, right = n - 1, leftMax = 0, rightMax = 0, water = 0\nwhile left <= right:\n  if arr[left] <= arr[right]:\n    if arr[left] >= leftMax: leftMax = arr[left] else water += leftMax - arr[left]\n    left += 1\n  else:\n    if arr[right] >= rightMax: rightMax = arr[right] else water += rightMax - arr[right]\n    right -= 1\nreturn water' },
    ],
  },
  {
    original_id: 'smfsbrryminimm', title: 'Sum of subarray minimums', difficulty: 'Medium', tags: ['Arrays', 'Stack', 'Data Structures'], repaired: true,
    parent: { front: 'Find the sum of the minimum element of every possible subarray.', back: 'Count how many subarrays use each value as their minimum. For each index, find the previous strictly smaller boundary and the next smaller-or-equal boundary with monotonic stacks, then add value * leftChoices * rightChoices.' },
    children: [
      { front: 'How does contribution counting replace enumerating subarrays?', back: 'If arr[i] is the chosen minimum, every subarray can start between the previous-smaller boundary and i, and end between i and the next-smaller boundary. The product counts all subarrays where arr[i] contributes.' },
      { front: 'Why use different strictness on the two boundaries?', back: 'For duplicate values, one side must claim equal elements and the other must stop at them. Using previous strictly smaller and next smaller-or-equal avoids double counting.' },
      { front: 'What stack structure is used?', back: 'Use monotonic increasing stacks of indices. Pop indices when the current value becomes the boundary that is smaller, then compute their left and right distances.' },
      { front: 'What is the complexity?', back: 'Each index enters and leaves each stack once. Time is O(n) and extra space is O(n); apply the required modulus if the platform requires it.' },
      { front: 'What is the contribution formula?', back: 'For index i, contribution = arr[i] * (i - previousSmallerIndex) * (nextSmallerOrEqualIndex - i). Sum contributions modulo the requested modulus.' },
    ],
  },
  {
    original_id: 'rmvkdigits', title: 'Remove K Digits', difficulty: 'Medium', tags: ['Stack', 'Data Structures', 'Greedy', 'Deque'], repaired: true,
    parent: { front: 'Remove exactly k digits from a non-negative numeric string to form the smallest possible remaining number.', back: 'Build a monotonic increasing stack of kept digits. Whenever the previous digit is larger than the current digit, remove it while k remains. Remove any leftover digits from the end, then strip leading zeros and return 0 for an empty result.' },
    children: [
      { front: 'Why is removing a larger previous digit greedy?', back: 'A larger digit earlier in the number has more impact on the result than later digits. Removing it when a smaller digit arrives produces the smallest lexicographic prefix.' },
      { front: 'What if k remains after scanning the string?', back: 'The stack is already non-decreasing, so remove the last k digits. This makes the remaining number as short/small as possible.' },
      { front: 'How are leading zeros handled?', back: 'After removals, strip leading zeros. If nothing remains, return the string "0".' },
      { front: 'What is the complexity?', back: 'Each digit is pushed and popped at most once, so time is O(n) and extra space is O(n).' },
      { front: 'Write the core pseudocode.', back: 'stack = empty\nfor digit in s:\n  while k > 0 and stack not empty and stack.top > digit: pop stack; k -= 1\n  push digit\nwhile k > 0: pop stack; k -= 1\nreturn stripLeadingZeros(stack) or "0"' },
    ],
  },
  {
    original_id: 'stckspnprblm', title: 'Stock span problem', difficulty: 'Medium', tags: ['Arrays', 'Stack', 'Data Structures'], repaired: true,
    parent: { front: 'For each stock price, find the number of consecutive days ending today whose prices are less than or equal to today’s price.', back: 'Maintain a decreasing stack of indices. Pop previous days with price less than or equal to the current price; the nearest remaining index is the first greater price to the left, so the span is i - index.' },
    children: [
      { front: 'What does the stack store?', back: 'Indices of days with strictly decreasing prices. They remain useful because a future price may need the nearest previous greater boundary.' },
      { front: 'What is the span when the stack becomes empty?', back: 'All previous prices are less than or equal to the current price, so the span is i + 1.' },
      { front: 'Why pop prices equal to the current price?', back: 'The definition includes prices less than or equal to today’s price, so equal previous prices should be absorbed into today’s span.' },
      { front: 'What is the complexity?', back: 'Each index is pushed once and popped once. Time is O(n) and extra space is O(n).' },
      { front: 'Write the pseudocode.', back: 'stack = empty, span = array\nfor i from 0 to n - 1:\n  while stack not empty and price[stack.top] <= price[i]: pop\n  span[i] = i + 1 if stack empty else i - stack.top\n  push i\nreturn span' },
    ],
  },
  {
    original_id: 'mxcnsctivnsiii', title: "Longest Consecutive 1's", difficulty: 'Easy', tags: ['Bit Magic', 'Data Structures'], repaired: true,
    parent: { front: "Find the length of the longest consecutive run of 1 bits in the binary representation of n.", back: 'Repeatedly apply n = n & (n << 1). Each operation removes one trailing 1 from every run, so the number of iterations until n becomes zero equals the longest run length.' },
    children: [
      { front: 'Why does n & (n << 1) shorten a run of ones?', back: 'A run such as 111 becomes 110 after shifting and ANDing, removing one 1 from its edge. Repeating this counts the longest run.' },
      { front: 'What is the alternative straightforward method?', back: 'Scan bits from right to left, track the current run when (n & 1) is one, reset it on zero, and shift n right each step.' },
      { front: 'What is the complexity of the bit trick?', back: 'Time is O(L), where L is the longest run of ones, and extra space is O(1). A normal bit scan is O(number of bits).' },
      { front: 'What result should n = 0 produce?', back: 'Zero has no set bits, so the longest consecutive run is 0. The given constraints use positive n, but this is the safe edge-case behavior.' },
      { front: 'Write the bit-trick pseudocode.', back: 'count = 0\nwhile n != 0:\n  n = n & (n << 1)\n  count += 1\nreturn count' },
    ],
  },
  {
    original_id: 'minhpndmxhpimplmnttin', title: 'Binary Heap Operations', difficulty: 'Medium', tags: ['Heap', 'Design-Pattern', 'Data Structures'], repaired: true,
    parent: { front: 'Implement insertKey, deleteKey, and extractMin for an array-backed binary min heap.', back: 'A binary heap is a complete tree represented by an array. Every parent is no larger than its children. Insert bubbles a value up, delete replaces a position and repairs the heap, and extractMin removes the root then bubbles the replacement down.' },
    children: [
      { front: 'What are the array relationships in a zero-based heap?', back: 'For index i, parent is (i - 1) // 2, left child is 2*i + 1, and right child is 2*i + 2.' },
      { front: 'How does insertKey work?', back: 'Append the new value at the end, then swap it upward while it is smaller than its parent. This restores the min-heap property.' },
      { front: 'How does extractMin work?', back: 'Save the root, move the last value to index 0, shrink the array, and repeatedly swap it with its smaller child until the heap property returns. Return -1 if empty.' },
      { front: 'How does deleteKey at position i work?', back: 'Decrease the value at i to a value smaller than the root, bubble it to the root, then extractMin. Alternatively replace it with the last value and repair upward or downward as appropriate.' },
      { front: 'What are the operation complexities?', back: 'Insert, extractMin, and deleteKey take O(log n). Reading the minimum is O(1), and the heap uses O(n) storage.' },
    ],
  },
  {
    original_id: 'chckifthbinrytrishightblncdrnt', title: 'Balanced Tree Check', difficulty: 'Easy', tags: ['Tree', 'Data Structures'], repaired: true,
    parent: { front: 'Determine whether every node in a binary tree has left and right subtree heights differing by at most one.', back: 'Use postorder recursion. Return the subtree height when balanced and return -1 immediately when an imbalance is found. A node is balanced when both child heights are valid and their difference is at most one.' },
    children: [
      { front: 'Why is postorder traversal needed?', back: 'A node’s balance depends on the heights of both children, so children must be evaluated before the node.' },
      { front: 'What sentinel can represent an unbalanced subtree?', back: 'Return -1. Any parent receiving -1 immediately propagates it without doing further height work.' },
      { front: 'What is the height convention?', back: 'Use height 0 for an empty subtree and 1 + max(leftHeight, rightHeight) for a non-empty node. The exact convention is fine if used consistently.' },
      { front: 'What is the complexity?', back: 'Each node is visited once, so time is O(n). Recursion uses O(h) stack space, where h is the tree height.' },
      { front: 'Write the recursive condition.', back: 'left = height(root.left); right = height(root.right)\nif left == -1 or right == -1 or abs(left - right) > 1: return -1\nreturn 1 + max(left, right)' },
    ],
  },
  {
    original_id: 'intrdctintbinrysrchtr', title: 'Binary Search Trees', difficulty: 'Easy', tags: [], repaired: true,
    parent: { front: 'Given an array representing inorder traversal, determine whether it can be the inorder traversal of a valid binary search tree.', back: 'An inorder traversal of a BST with unique keys is strictly increasing. Scan adjacent values and return false if any value is not greater than the previous one.' },
    children: [
      { front: 'What property of BST inorder traversal is used?', back: 'Inorder traversal visits left subtree, root, then right subtree, which produces sorted order. Unique keys make the order strictly increasing.' },
      { front: 'Why is the answer not based on reconstructing a tree?', back: 'The sorted-order property is both necessary and sufficient for an inorder sequence of some BST, so reconstruction is unnecessary.' },
      { front: 'What happens when duplicate values appear?', back: 'The sequence is invalid under the stated unique-key rule because adjacent equal values violate strict increase.' },
      { front: 'What is the complexity?', back: 'Time is O(n) and extra space is O(1) when scanning the array directly.' },
      { front: 'Write the pseudocode.', back: 'for i from 1 to n - 1:\n  if arr[i] <= arr[i - 1]: return false\nreturn true' },
    ],
  },
  {
    original_id: 'findkthsmllstlrgstlmntinbst', title: 'k-th Smallest in BST', difficulty: 'Medium', tags: ['Binary Search Tree', 'Data Structures'], repaired: true,
    parent: { front: 'Find the k-th smallest element in a binary search tree, or -1 if fewer than k nodes exist.', back: 'Inorder traversal of a BST visits values in ascending order. Use an explicit stack to traverse left, visit nodes, then traverse right, counting visited nodes until count equals k.' },
    children: [
      { front: 'Why does inorder traversal return sorted values?', back: 'BST ordering places smaller values in the left subtree and larger values in the right subtree, so left-root-right order is ascending.' },
      { front: 'How does the iterative stack traversal work?', back: 'Push the entire left path, pop one node to visit it, decrement k, then move to its right subtree and repeat.' },
      { front: 'What if k is larger than the number of nodes?', back: 'The traversal ends with no node at rank k, so return -1.' },
      { front: 'What is the complexity?', back: 'Time is O(h + k) in the usual early-stop analysis and O(n) worst case. Auxiliary space is O(h), where h is tree height.' },
      { front: 'Write the traversal skeleton.', back: 'stack = empty, node = root\nwhile node != null or stack not empty:\n  while node != null: push node; node = node.left\n  node = pop stack; k -= 1\n  if k == 0: return node.value\n  node = node.right\nreturn -1' },
    ],
  },
  {
    original_id: 'primslgrithm', title: 'Minimum Spanning Tree', difficulty: 'Medium', tags: ['Greedy', 'Graph', 'Data Structures', 'Algorithms'], repaired: true,
    parent: { front: 'Find the total weight of a minimum spanning tree in a connected weighted undirected graph.', back: 'A minimum spanning tree connects every vertex with no cycles and minimum total edge weight. Kruskal sorts edges and uses disjoint set union to accept an edge only when it joins two different components; Prim is another valid greedy approach.' },
    children: [
      { front: 'What makes an edge safe for Kruskal’s algorithm?', back: 'Process edges from smallest weight to largest and accept an edge if its endpoints are in different DSU components. This avoids cycles and preserves the MST greedy invariant.' },
      { front: 'What operations does DSU provide?', back: 'find identifies a component representative, and union merges two components. Path compression and union by rank/size make operations nearly constant amortized time.' },
      { front: 'How many edges does an MST contain?', back: 'For a connected graph with V vertices, every spanning tree has exactly V - 1 edges.' },
      { front: 'What is Kruskal complexity?', back: 'Sorting takes O(E log E). DSU processing is O(E alpha(V)), so total time is O(E log E) and space is O(V + E).' },
      { front: 'When would Prim be a convenient alternative?', back: 'Prim grows one tree from a chosen vertex using a min-priority queue and is convenient with adjacency lists, especially when working from a graph rather than a flat edge list.' },
    ],
  },
  {
    original_id: 'gridniqpths2dp9', title: 'Grid Path 2', difficulty: 'Medium', tags: ['Matrix', 'Dynamic Programming', 'Arrays', 'Data Structures', 'Algorithms'], repaired: true,
    parent: { front: 'Count the ways to move from the top-left to bottom-right of a 0/1 grid using only right and down moves, where 1 marks an obstacle.', back: 'Use dynamic programming. dp[j] stores the number of ways to reach the current row’s cell in column j. An obstacle has zero ways; otherwise ways come from above plus the left cell, modulo 1e9+7.' },
    children: [
      { front: 'What is the DP recurrence for a free cell?', back: 'ways[i][j] = ways[i - 1][j] + ways[i][j - 1]. Only the top and left neighbors can reach the cell.' },
      { front: 'How should the starting cell be handled?', back: 'If grid[0][0] is blocked, the answer is zero. Otherwise it starts with one way.' },
      { front: 'How does the one-dimensional DP work?', back: 'For each row and column, set dp[j] = 0 for an obstacle; otherwise dp[j] = dp[j] + dp[j - 1] when j > 0. The old dp[j] is the value from above.' },
      { front: 'What is the complexity?', back: 'Time is O(nm), and the one-dimensional optimization uses O(m) extra space.' },
      { front: 'Why is modulo required?', back: 'The number of paths grows quickly. Take every addition modulo 1e9 + 7 to keep values bounded while preserving the required answer.' },
    ],
  },
  {
    original_id: 'minimmpthsmingriddp10', title: 'Minimum Cost Path', difficulty: 'Hard', tags: ['Graph', 'Data Structures', 'Algorithms', 'Dynamic Programming', 'Heap'], repaired: true,
    parent: { front: 'Find the minimum cost path from the top-left to bottom-right of a square grid when movement is allowed in all four directions.', back: 'Because movement can go in four directions, use Dijkstra’s algorithm on grid cells as graph vertices. The distance of a neighbor is relaxed with current distance plus that cell’s cost; a min-heap processes the smallest distance first.' },
    children: [
      { front: 'Why is ordinary right/down grid DP insufficient?', back: 'Four-direction movement can revisit rows and columns and may improve an earlier cell through a different route. The graph has cycles, so shortest-path relaxation is needed.' },
      { front: 'What does the priority queue store?', back: 'Pairs of current known distance and cell coordinates, ordered by smallest distance. Ignore a popped entry if it is stale compared with dist[row][col].' },
      { front: 'What cost is added during a move?', back: 'Add the cost of the destination cell when relaxing a neighbor. Initialize the source distance with the cost of the top-left cell.' },
      { front: 'What is the complexity?', back: 'There are N^2 cells and at most four edges per cell. With a binary heap, time is O(N^2 log N) up to constant factors and space is O(N^2).' },
      { front: 'Write the relaxation rule.', back: 'for each valid neighbor (nr, nc):\n  candidate = dist[r][c] + grid[nr][nc]\n  if candidate < dist[nr][nc]:\n    dist[nr][nc] = candidate\n    push(candidate, nr, nc)' },
    ],
  },
  {
    original_id: '3ddpninjndhisfrindsdp13', title: 'Chocolates Pickup', difficulty: 'Hard', tags: ['Dynamic Programming'], repaired: true,
    parent: { front: 'Two robots collect maximum chocolates while moving row by row from the top corners to the bottom row; a shared cell’s chocolates count once.', back: 'Use DP state (row, col1, col2), representing both robot columns on the current row. Try each of the nine combinations of -1, 0, and +1 column moves. Add one cell’s value when both columns match, otherwise add both.' },
    children: [
      { front: 'What is the DP state?', back: 'dp[row][c1][c2] is the maximum chocolates collectible from row onward when robot 1 is at column c1 and robot 2 is at column c2.' },
      { front: 'How is a row’s chocolate value counted?', back: 'If c1 == c2, add grid[row][c1] once. Otherwise add grid[row][c1] + grid[row][c2].' },
      { front: 'How many transitions exist per state?', back: 'Each robot can move left, straight, or right, producing 3 * 3 = 9 next-column combinations, discarding out-of-bound positions.' },
      { front: 'What are the complexity bounds?', back: 'There are O(n * m^2) states and nine transitions each, so time is O(nm^2) and space is O(nm^2), reducible to two row layers.' },
      { front: 'What is the base case at the last row?', back: 'Return the chocolate value at the two final positions, counted once if the robots share the cell and twice otherwise.' },
    ],
  },
  {
    original_id: 'distinctsbsqncsdp32', title: 'Number of distinct subsequences', difficulty: 'Hard', tags: ['Strings', 'Dynamic Programming', 'Data Structures', 'Algorithms'], repaired: true,
    parent: { front: 'Count distinct subsequences of a lowercase string, including the empty subsequence, modulo 1e9+7.', back: 'Let dp[i] be the number of distinct subsequences using the first i characters. Every new character doubles the choices, but repeats duplicate subsequences already created by the previous occurrence; subtract dp[last[c]].' },
    children: [
      { front: 'What is the recurrence?', back: 'Without a repeat, dp[i] = 2 * dp[i - 1]. If character c previously appeared at position p, dp[i] = 2 * dp[i - 1] - dp[p - 1] (with indexing adjusted to the implementation).' },
      { front: 'What is the base case?', back: 'dp[0] = 1 because the empty subsequence is included.' },
      { front: 'Why are duplicates subtracted?', back: 'Appending the new character to all previous subsequences duplicates exactly the subsequences that were already generated when the same character appeared earlier.' },
      { front: 'What is the complexity?', back: 'With a last-occurrence array for the alphabet, time is O(n) and space is O(number of alphabet symbols), or O(n) for a full DP array.' },
      { front: 'How should negative modulo values be handled?', back: 'After subtraction, normalize with (value % MOD + MOD) % MOD so the stored result remains non-negative.' },
    ],
  },
  {
    original_id: 'wildcrdmtchingdp34', title: 'Wildcard Pattern Matching', difficulty: 'Medium', tags: ['Dynamic Programming', 'Algorithms', 'Recursion', 'Strings'], repaired: true,
    parent: { front: 'Determine whether a wildcard pattern matches an entire text, where ? matches one character and * matches any sequence, including empty.', back: 'Use DP over pattern and text prefixes. A normal character or ? consumes one character; * either matches empty and advances the pattern or consumes one text character and keeps the pattern.' },
    children: [
      { front: 'What is the recurrence for a normal character or ?', back: 'If the pattern character equals the text character or is ?, dp[i][j] = dp[i - 1][j - 1]. Otherwise the state is false.' },
      { front: 'What is the recurrence for *?', back: 'dp[i][j] = dp[i - 1][j] OR dp[i][j - 1]. The first branch treats * as empty; the second lets * consume the current text character.' },
      { front: 'What are the important base cases?', back: 'An empty pattern matches only empty text. An empty text matches a pattern prefix only when every character in that prefix is *.' },
      { front: 'What is the complexity?', back: 'The straightforward DP takes O(P*T) time and O(P*T) space, reducible to O(T) space by keeping the previous row.' },
      { front: 'Does the match allow a partial text match?', back: 'No. The entire text must be consumed, so the final state must be dp[P][T].' },
    ],
  },
  {
    original_id: 'byndsllstckiidp36', title: 'Stock Buy and Sell – Max one Transaction Allowed', difficulty: 'Easy', tags: ['Greedy', 'Arrays'], repaired: true,
    parent: { front: 'Find the maximum profit from at most one stock buy followed by one later sell.', back: 'Scan prices once while tracking the minimum price seen so far. Selling today gives price - minimumPrice; update the maximum profit and then update the minimum.' },
    children: [
      { front: 'Why must the minimum price be from an earlier day?', back: 'The scan updates the profit using the previous minimum before considering the current price as a future buying price, preserving buy-before-sell order.' },
      { front: 'What if prices continuously decrease?', back: 'Every sale would lose money, so the maximum profit remains zero because making no transaction is allowed.' },
      { front: 'What is the one-pass algorithm?', back: 'minPrice = infinity, profit = 0; for each price: profit = max(profit, price - minPrice); minPrice = min(minPrice, price).' },
      { front: 'What is the complexity?', back: 'Time is O(n) and extra space is O(1).' },
      { front: 'What does at most one transaction mean?', back: 'One transaction consists of one buy and one sell. Multiple buy/sell pairs are not allowed in this problem.' },
    ],
  },
  {
    original_id: 'mximmxrftwnmbrsinnrry', title: 'Maximum XOR of two numbers in an array', difficulty: 'Medium', tags: ['Bit Magic', 'Data Structures'], repaired: true,
    parent: { front: 'Find the maximum XOR obtainable from any two numbers in an array.', back: 'Use a binary trie of numbers. For each number, greedily choose the opposite bit at each position when available, because a differing high bit contributes more to XOR than all lower bits combined.' },
    children: [
      { front: 'Why does the trie greedily prefer the opposite bit?', back: 'XOR is maximized by making the highest currently considered bit equal to 1. A choice at a higher bit dominates every possible lower-bit improvement.' },
      { front: 'What does each trie path represent?', back: 'Each path stores one number’s bits from the most significant bit to the least significant bit. Nodes have up to two children, for bit 0 and bit 1.' },
      { front: 'How is the best partner found for a number x?', back: 'Start at the highest bit and follow the child containing 1 - bit(x) when it exists; otherwise follow bit(x). Accumulate the XOR value.' },
      { front: 'What is the complexity?', back: 'For B-bit integers, building and querying the trie take O(nB) time and O(nB) space. With fixed-width integers this is effectively O(n).' },
      { front: 'What edge cases matter?', back: 'The array must contain at least two numbers. Use a fixed bit width that covers the maximum allowed value, and use non-negative integer bit operations.' },
    ],
  },
];
