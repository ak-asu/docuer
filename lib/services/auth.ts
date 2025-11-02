// Simple auth service for prototype
// NOT for production - stores credentials in code

export interface User {
  id: string;
  name: string;
  email: string;
  password: string; // Plain text - PROTOTYPE ONLY
  profile: {
    level: "beginner" | "intermediate" | "advanced";
    learningStyle: string;
    background: string;
    interests: string[];
  };
}

// Hardcoded user profiles for prototype
export const USERS: User[] = [
  {
    id: "user-alice",
    name: "Alice Johnson",
    email: "dc00lk1d786@gmail.com",
    password: "alice123",
    profile: {
      level: "beginner",
      learningStyle: "Visual examples and analogies",
      background: "No prior programming experience",
      interests: ["Building personal websites", "Web design basics"],
    },
  },
  {
    id: "user-bob",
    name: "Bob Smith",
    email: "bob@example.com",
    password: "bob123",
    profile: {
      level: "advanced",
      learningStyle: "Technical depth with code examples",
      background: "5 years professional development experience",
      interests: [
        "State management",
        "Performance optimization",
        "System architecture",
      ],
    },
  },
];

class AuthService {
  private currentUser: User | null = null;

  /**
   * Login with email and password
   */
  login(email: string, password: string): User | null {
    const user = USERS.find(
      (u) => u.email === email && u.password === password,
    );

    if (user) {
      this.currentUser = user;
      // Store in localStorage for persistence
      if (typeof window !== "undefined") {
        localStorage.setItem("currentUser", JSON.stringify(user));
      }
      return user;
    }

    return null;
  }

  /**
   * Logout current user
   */
  logout(): void {
    this.currentUser = null;
    if (typeof window !== "undefined") {
      localStorage.removeItem("currentUser");
    }
  }

  /**
   * Get current logged-in user
   */
  getCurrentUser(): User | null {
    if (this.currentUser) {
      return this.currentUser;
    }

    // Try to restore from localStorage
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("currentUser");
      if (stored) {
        this.currentUser = JSON.parse(stored);
        return this.currentUser;
      }
    }

    return null;
  }

  /**
   * Check if user is logged in
   */
  isAuthenticated(): boolean {
    return this.getCurrentUser() !== null;
  }

  /**
   * Get user by ID
   */
  getUserById(userId: string): User | null {
    return USERS.find((u) => u.id === userId) || null;
  }

  /**
   * Get all users (for testing/demo purposes)
   */
  getAllUsers(): User[] {
    return USERS;
  }
}

// Export singleton instance
export const authService = new AuthService();
