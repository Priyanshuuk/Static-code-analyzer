// Default code snippets for each language — competitive programming style
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

  cpp: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    int t;
    cin >> t;
    while (t--) {
        int n;
        cin >> n;
        cout << n * n << "\\n";
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

  javascript: `const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin });
const lines = [];

rl.on('line', (line) => lines.push(line.trim()));
rl.on('close', () => {
    let idx = 0;
    const next = () => lines[idx++];
    const t = parseInt(next());
    for (let i = 0; i < t; i++) {
        const n = parseInt(next());
        console.log(n * n);
    }
});`,

  typescript: `const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin });
const lines: string[] = [];

rl.on('line', (line: string) => lines.push(line.trim()));
rl.on('close', () => {
    let idx: number = 0;
    const next = (): string => lines[idx++];
    const t: number = parseInt(next());
    for (let i: number = 0; i < t; i++) {
        const n: number = parseInt(next());
        console.log(n * n);
    }
});`,

  go: `package main

import (
\t"bufio"
\t"fmt"
\t"os"
)

func main() {
\treader := bufio.NewReader(os.Stdin)
\twriter := bufio.NewWriter(os.Stdout)
\tdefer writer.Flush()

\tvar t int
\tfmt.Fscan(reader, &t)
\tfor ; t > 0; t-- {
\t\tvar n int
\t\tfmt.Fscan(reader, &n)
\t\tfmt.Fprintln(writer, n*n)
\t}
}`,

  rust: `use std::io::{self, BufRead, Write, BufWriter};

fn main() {
    let stdin = io::stdin();
    let stdout = io::stdout();
    let mut out = BufWriter::new(stdout.lock());

    let mut lines = stdin.lock().lines();
    let t: usize = lines.next().unwrap().unwrap().trim().parse().unwrap();
    for _ in 0..t {
        let n: i64 = lines.next().unwrap().unwrap().trim().parse().unwrap();
        writeln!(out, "{}", n * n).unwrap();
    }
}`,
};

// Language metadata
export const LANGUAGES = [
  { id: 'cpp',        label: 'C++',        monacoId: 'cpp',        icon: '⚡' },
  { id: 'c',          label: 'C',          monacoId: 'c',          icon: '🔧' },
  { id: 'python',     label: 'Python',     monacoId: 'python',     icon: '🐍' },
  { id: 'java',       label: 'Java',       monacoId: 'java',       icon: '☕' },
  { id: 'javascript', label: 'JavaScript', monacoId: 'javascript', icon: '🟨' },
  { id: 'typescript', label: 'TypeScript', monacoId: 'typescript', icon: '🔷' },
  { id: 'go',         label: 'Go',         monacoId: 'go',         icon: '🐹' },
  { id: 'rust',       label: 'Rust',       monacoId: 'rust',       icon: '🦀' },
];
