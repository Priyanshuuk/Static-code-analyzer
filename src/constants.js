export const DEFAULT_CODE = {
  c: `#include <stdio.h>

int main() {
    int t;
    scanf("%d", &t);
    while (t--) {
        int n;
        scanf("%d", &n);
        printf("%d\\n", n * n);
    }
    return 0;
}`,
  python: `import sys
input = sys.stdin.readline

def solve():
    n = int(input())
    print(n * n)

t = int(input())
for _ in range(t):
    solve()`,
  java: `import java.util.*;
import java.io.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        int t = Integer.parseInt(br.readLine().trim());
        StringBuilder sb = new StringBuilder();
        while (t-- > 0) {
            int n = Integer.parseInt(br.readLine().trim());
            sb.append(n * n).append('\\n');
        }
        System.out.print(sb);
    }
}`,
};

export const LANGUAGES = [
  { id: 'c',      label: 'C',       monacoId: 'c',      icon: '🔧' },
  { id: 'python', label: 'Python',  monacoId: 'python', icon: '🐍' },
  { id: 'java',   label: 'Java',    monacoId: 'java',   icon: '☕' },
];

export const C_DEFAULT_SAMPLE = `#include <stdio.h>

int main() {
    int a, b;
    a = 10;
    b = a * 2 + 5;
    printf("Result: %d\\n", b);
    return 0;
}`;

export const TOKEN_COLORS = {
  KEYWORD: '#c678dd',
  IDENTIFIER: '#61afef',
  CONSTANT: '#d19a66',
  STRING_LITERAL: '#98c379',
  CHAR_LITERAL: '#98c379',
  OPERATOR: '#56b6c2',
  DELIMITER: '#abb2bf',
  PREPROCESSOR: '#e5c07b',
  COMMENT: '#5c6370',
  ERROR: '#e06c75',
};

export const DFA_TYPES = [
  { id: 'identifier', label: 'Identifier DFA', pattern: 'Letter (Letter | Digit)*', example: 'x, count, _temp' },
  { id: 'number',     label: 'Number DFA',     pattern: 'Digit+ (. Digit+)? (E [+-]? Digit+)?', example: '42, 3.14, 1e5' },
  { id: 'operator',   label: 'Operator DFA',   pattern: 'One of: + - * / = < > ! & |', example: '+, -, *, /, ==, !=, &&' },
  { id: 'keyword',    label: 'Keyword DFA',    pattern: 'Reserved words', example: 'int, if, else, while, return' },
];

export const SMART_LANG_DEFAULT = `// Mini-Language Demo
let x: int = 10;
let y: int = 20;
let result: int;

if (x < y) {
    print(x);
} else {
    print(y);
}

while (x > 0) {
    print(x);
    x = x - 1;
}

result = x + y * 2;
print(result);`;
