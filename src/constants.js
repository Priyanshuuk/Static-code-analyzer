// Default code snippets for each language
export const DEFAULT_CODE = {
    c: `#include <stdio.h>

int main() {
    printf("Hello, World!\\n");
    
    // Variables
    int x = 42;
    float pi = 3.14159;
    
    printf("The answer is %d\\n", x);
    printf("Pi is approximately %.2f\\n", pi);
    
    // Loop example
    for (int i = 0; i < 5; i++) {
        printf("Iteration %d\\n", i);
    }
    
    return 0;
}`,

    python: `# Python — Hello World
def greet(name: str) -> str:
    """Generate a greeting message."""
    return f"Hello, {name}! 👋"

def fibonacci(n: int) -> list:
    """Generate Fibonacci sequence up to n terms."""
    sequence = []
    a, b = 0, 1
    for _ in range(n):
        sequence.append(a)
        a, b = b, a + b
    return sequence

# Main
if __name__ == "__main__":
    print(greet("World"))
    
    fib = fibonacci(10)
    print(f"Fibonacci(10): {fib}")
    
    # List comprehension
    squares = [x**2 for x in range(1, 6)]
    print(f"Squares: {squares}")`,

    java: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
        
        // Variables
        int number = 42;
        String message = "The answer is: " + number;
        System.out.println(message);
        
        // Array and loop
        int[] fibonacci = {0, 1, 1, 2, 3, 5, 8, 13, 21, 34};
        System.out.print("Fibonacci: ");
        for (int f : fibonacci) {
            System.out.print(f + " ");
        }
        System.out.println();
        
        // Method call
        System.out.println("5! = " + factorial(5));
    }
    
    static int factorial(int n) {
        if (n <= 1) return 1;
        return n * factorial(n - 1);
    }
}`,


};

// Language metadata
export const LANGUAGES = [
    { id: 'c', label: 'C', monacoId: 'c', icon: '🔧' },
    { id: 'python', label: 'Python', monacoId: 'python', icon: '🐍' },
    { id: 'java', label: 'Java', monacoId: 'java', icon: '☕' },
];
