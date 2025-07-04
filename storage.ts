import { 
  users, 
  categories, 
  expenses, 
  type User, 
  type InsertUser, 
  type Category, 
  type InsertCategory, 
  type Expense, 
  type InsertExpense,
  type ExpenseWithCategory 
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Categories
  getAllCategories(): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  
  // Expenses
  getExpensesByUserId(userId: number): Promise<ExpenseWithCategory[]>;
  getExpensesByUserIdAndMonth(userId: number, year: number, month: number): Promise<ExpenseWithCategory[]>;
  getExpensesByUserIdAndPeriod(userId: number, period: 'day' | 'week' | 'month' | 'year', date?: Date): Promise<ExpenseWithCategory[]>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  updateExpense(id: number, expense: Partial<InsertExpense>): Promise<Expense | undefined>;
  deleteExpense(id: number): Promise<boolean>;
  getCategoryTotals(userId: number, year: number, month: number): Promise<{ categoryId: number; categoryName: string; total: number; color: string; icon: string }[]>;
  getCategoryTotalsByPeriod(userId: number, period: 'day' | 'week' | 'month' | 'year', date?: Date): Promise<{ categoryId: number; categoryName: string; total: number; color: string; icon: string }[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private categories: Map<number, Category>;
  private expenses: Map<number, Expense>;
  private currentUserId: number;
  private currentCategoryId: number;
  private currentExpenseId: number;

  constructor() {
    this.users = new Map();
    this.categories = new Map();
    this.expenses = new Map();
    this.currentUserId = 1;
    this.currentCategoryId = 1;
    this.currentExpenseId = 1;
    
    // Initialize default categories
    this.initializeDefaultCategories();
    // Initialize sample data
    this.initializeSampleData();
  }

  private initializeDefaultCategories() {
    const defaultCategories = [
      { name: "Food", icon: "fas fa-utensils", color: "blue" },
      { name: "Transport", icon: "fas fa-car", color: "green" },
      { name: "Shopping", icon: "fas fa-shopping-bag", color: "purple" },
      { name: "Business", icon: "fas fa-briefcase", color: "amber" },
      { name: "Entertainment", icon: "fas fa-film", color: "red" },
      { name: "Health", icon: "fas fa-heart", color: "pink" },
      { name: "Education", icon: "fas fa-graduation-cap", color: "indigo" },
      { name: "Utilities", icon: "fas fa-bolt", color: "yellow" },
    ];

    defaultCategories.forEach(cat => {
      const category: Category = {
        id: this.currentCategoryId++,
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
      };
      this.categories.set(category.id, category);
    });
  }

  private initializeSampleData() {
    // Create sample expenses for different time periods
    const now = new Date();
    const sampleExpenses = [
      // Today
      {
        userId: 1,
        amount: "15.50",
        categoryId: 1, // Food
        merchant: "Starbucks",
        description: "Morning coffee",
        date: now.toISOString(),
        source: "manual",
        notes: "Latte with extra shot"
      },
      {
        userId: 1,
        amount: "45.80",
        categoryId: 1, // Food
        merchant: "Thai Restaurant",
        description: "Lunch meeting",
        date: now.toISOString(),
        source: "manual",
        notes: "Business lunch"
      },
      // Yesterday
      {
        userId: 1,
        amount: "25.00",
        categoryId: 2, // Transport
        merchant: "Uber",
        description: "Ride to airport",
        date: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
        source: "ai_scan",
        notes: null
      },
      // This week
      {
        userId: 1,
        amount: "120.00",
        categoryId: 3, // Shopping
        merchant: "Amazon",
        description: "Office supplies",
        date: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        source: "bank_sync",
        notes: "Desk organizers and notebooks"
      },
      // This month
      {
        userId: 1,
        amount: "85.90",
        categoryId: 8, // Utilities
        merchant: "Electric Company",
        description: "Monthly electricity bill",
        date: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        source: "bank_sync",
        notes: null
      },
      {
        userId: 1,
        amount: "200.00",
        categoryId: 4, // Business
        merchant: "Co-working Space",
        description: "Monthly membership",
        date: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        source: "manual",
        notes: "Premium plan with meeting rooms"
      }
    ];

    sampleExpenses.forEach(expenseData => {
      const id = this.currentExpenseId++;
      const expense: Expense = {
        id,
        userId: expenseData.userId,
        amount: expenseData.amount,
        categoryId: expenseData.categoryId,
        merchant: expenseData.merchant,
        description: expenseData.description,
        date: new Date(expenseData.date),
        receiptUrl: null,
        notes: expenseData.notes,
        source: expenseData.source,
        createdAt: new Date(),
      };
      this.expenses.set(id, expense);
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getAllCategories(): Promise<Category[]> {
    return Array.from(this.categories.values());
  }

  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const id = this.currentCategoryId++;
    const category: Category = { ...insertCategory, id };
    this.categories.set(id, category);
    return category;
  }

  async getExpensesByUserId(userId: number): Promise<ExpenseWithCategory[]> {
    const userExpenses = Array.from(this.expenses.values())
      .filter(expense => expense.userId === userId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return userExpenses.map(expense => ({
      ...expense,
      category: this.categories.get(expense.categoryId)!,
    }));
  }

  async getExpensesByUserIdAndMonth(userId: number, year: number, month: number): Promise<ExpenseWithCategory[]> {
    const userExpenses = Array.from(this.expenses.values())
      .filter(expense => {
        if (expense.userId !== userId) return false;
        const expenseDate = new Date(expense.date);
        return expenseDate.getFullYear() === year && expenseDate.getMonth() === month - 1;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return userExpenses.map(expense => ({
      ...expense,
      category: this.categories.get(expense.categoryId)!,
    }));
  }

  async createExpense(insertExpense: InsertExpense): Promise<Expense> {
    const id = this.currentExpenseId++;
    const expense: Expense = {
      id,
      userId: insertExpense.userId!,
      amount: insertExpense.amount,
      categoryId: insertExpense.categoryId!,
      merchant: insertExpense.merchant || null,
      description: insertExpense.description || null,
      date: new Date(insertExpense.date),
      receiptUrl: insertExpense.receiptUrl || null,
      notes: insertExpense.notes || null,
      source: insertExpense.source || "manual",
      createdAt: new Date(),
    };
    this.expenses.set(id, expense);
    return expense;
  }

  async updateExpense(id: number, updateData: Partial<InsertExpense>): Promise<Expense | undefined> {
    const expense = this.expenses.get(id);
    if (!expense) return undefined;

    const updatedExpense = {
      ...expense,
      ...updateData,
      date: updateData.date ? new Date(updateData.date) : expense.date,
    };
    this.expenses.set(id, updatedExpense);
    return updatedExpense;
  }

  async deleteExpense(id: number): Promise<boolean> {
    return this.expenses.delete(id);
  }

  async getCategoryTotals(userId: number, year: number, month: number): Promise<{ categoryId: number; categoryName: string; total: number; color: string; icon: string }[]> {
    const monthlyExpenses = await this.getExpensesByUserIdAndMonth(userId, year, month);
    
    const categoryTotals = new Map<number, number>();
    
    monthlyExpenses.forEach(expense => {
      const current = categoryTotals.get(expense.categoryId) || 0;
      categoryTotals.set(expense.categoryId, current + parseFloat(expense.amount));
    });

    const result = Array.from(categoryTotals.entries()).map(([categoryId, total]) => {
      const category = this.categories.get(categoryId)!;
      return {
        categoryId,
        categoryName: category.name,
        total,
        color: category.color,
        icon: category.icon,
      };
    });

    return result.sort((a, b) => b.total - a.total);
  }

  async getExpensesByUserIdAndPeriod(userId: number, period: 'day' | 'week' | 'month' | 'year', date: Date = new Date()): Promise<ExpenseWithCategory[]> {
    const userExpenses = Array.from(this.expenses.values())
      .filter(expense => {
        if (expense.userId !== userId) return false;
        
        const expenseDate = new Date(expense.date);
        const referenceDate = new Date(date);
        
        switch (period) {
          case 'day':
            return expenseDate.toDateString() === referenceDate.toDateString();
          
          case 'week':
            const weekStart = new Date(referenceDate);
            weekStart.setDate(referenceDate.getDate() - referenceDate.getDay());
            weekStart.setHours(0, 0, 0, 0);
            
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);
            
            return expenseDate >= weekStart && expenseDate <= weekEnd;
          
          case 'month':
            return expenseDate.getFullYear() === referenceDate.getFullYear() && 
                   expenseDate.getMonth() === referenceDate.getMonth();
          
          case 'year':
            return expenseDate.getFullYear() === referenceDate.getFullYear();
          
          default:
            return false;
        }
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return userExpenses.map(expense => ({
      ...expense,
      category: this.categories.get(expense.categoryId)!,
    }));
  }

  async getCategoryTotalsByPeriod(userId: number, period: 'day' | 'week' | 'month' | 'year', date: Date = new Date()): Promise<{ categoryId: number; categoryName: string; total: number; color: string; icon: string }[]> {
    const periodExpenses = await this.getExpensesByUserIdAndPeriod(userId, period, date);
    
    const categoryTotals = new Map<number, number>();
    
    periodExpenses.forEach(expense => {
      const current = categoryTotals.get(expense.categoryId) || 0;
      categoryTotals.set(expense.categoryId, current + parseFloat(expense.amount));
    });

    const result = Array.from(categoryTotals.entries()).map(([categoryId, total]) => {
      const category = this.categories.get(categoryId)!;
      return {
        categoryId,
        categoryName: category.name,
        total,
        color: category.color,
        icon: category.icon,
      };
    });

    return result.sort((a, b) => b.total - a.total);
  }
}

// Database Storage Implementation
export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getAllCategories(): Promise<Category[]> {
    return await db.select().from(categories);
  }

  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const [category] = await db
      .insert(categories)
      .values(insertCategory)
      .returning();
    return category;
  }

  async getExpensesByUserId(userId: number): Promise<ExpenseWithCategory[]> {
    const result = await db
      .select({
        id: expenses.id,
        userId: expenses.userId,
        amount: expenses.amount,
        categoryId: expenses.categoryId,
        merchant: expenses.merchant,
        description: expenses.description,
        date: expenses.date,
        receiptUrl: expenses.receiptUrl,
        notes: expenses.notes,
        source: expenses.source,
        createdAt: expenses.createdAt,
        category: {
          id: categories.id,
          name: categories.name,
          icon: categories.icon,
          color: categories.color,
        },
      })
      .from(expenses)
      .innerJoin(categories, eq(expenses.categoryId, categories.id))
      .where(eq(expenses.userId, userId))
      .orderBy(desc(expenses.date));

    return result.map(row => ({
      ...row,
      category: row.category,
    }));
  }

  async getExpensesByUserIdAndMonth(userId: number, year: number, month: number): Promise<ExpenseWithCategory[]> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const result = await db
      .select({
        id: expenses.id,
        userId: expenses.userId,
        amount: expenses.amount,
        categoryId: expenses.categoryId,
        merchant: expenses.merchant,
        description: expenses.description,
        date: expenses.date,
        receiptUrl: expenses.receiptUrl,
        notes: expenses.notes,
        source: expenses.source,
        createdAt: expenses.createdAt,
        category: {
          id: categories.id,
          name: categories.name,
          icon: categories.icon,
          color: categories.color,
        },
      })
      .from(expenses)
      .innerJoin(categories, eq(expenses.categoryId, categories.id))
      .where(
        and(
          eq(expenses.userId, userId),
          gte(expenses.date, startDate),
          lte(expenses.date, endDate)
        )
      )
      .orderBy(desc(expenses.date));

    return result.map(row => ({
      ...row,
      category: row.category,
    }));
  }

  async getExpensesByUserIdAndPeriod(userId: number, period: 'day' | 'week' | 'month' | 'year', date: Date = new Date()): Promise<ExpenseWithCategory[]> {
    let startDate: Date;
    let endDate: Date;

    const referenceDate = new Date(date);

    switch (period) {
      case 'day':
        startDate = new Date(referenceDate);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(referenceDate);
        endDate.setHours(23, 59, 59, 999);
        break;
      
      case 'week':
        startDate = new Date(referenceDate);
        startDate.setDate(referenceDate.getDate() - referenceDate.getDay());
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        break;
      
      case 'month':
        startDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
        endDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
      
      case 'year':
        startDate = new Date(referenceDate.getFullYear(), 0, 1);
        endDate = new Date(referenceDate.getFullYear(), 11, 31, 23, 59, 59, 999);
        break;
      
      default:
        throw new Error(`Invalid period: ${period}`);
    }

    const result = await db
      .select({
        id: expenses.id,
        userId: expenses.userId,
        amount: expenses.amount,
        categoryId: expenses.categoryId,
        merchant: expenses.merchant,
        description: expenses.description,
        date: expenses.date,
        receiptUrl: expenses.receiptUrl,
        notes: expenses.notes,
        source: expenses.source,
        createdAt: expenses.createdAt,
        category: {
          id: categories.id,
          name: categories.name,
          icon: categories.icon,
          color: categories.color,
        },
      })
      .from(expenses)
      .innerJoin(categories, eq(expenses.categoryId, categories.id))
      .where(
        and(
          eq(expenses.userId, userId),
          gte(expenses.date, startDate),
          lte(expenses.date, endDate)
        )
      )
      .orderBy(desc(expenses.date));

    return result.map(row => ({
      ...row,
      category: row.category,
    }));
  }

  async createExpense(insertExpense: InsertExpense): Promise<Expense> {
    const [expense] = await db
      .insert(expenses)
      .values({
        userId: insertExpense.userId!,
        amount: insertExpense.amount,
        categoryId: insertExpense.categoryId!,
        merchant: insertExpense.merchant || null,
        description: insertExpense.description || null,
        date: new Date(insertExpense.date),
        receiptUrl: insertExpense.receiptUrl || null,
        notes: insertExpense.notes || null,
        source: insertExpense.source || "manual",
      })
      .returning();
    return expense;
  }

  async updateExpense(id: number, updateData: Partial<InsertExpense>): Promise<Expense | undefined> {
    const updateValues: any = {};
    
    if (updateData.amount !== undefined) updateValues.amount = updateData.amount;
    if (updateData.categoryId !== undefined) updateValues.categoryId = updateData.categoryId;
    if (updateData.merchant !== undefined) updateValues.merchant = updateData.merchant;
    if (updateData.description !== undefined) updateValues.description = updateData.description;
    if (updateData.date !== undefined) updateValues.date = new Date(updateData.date);
    if (updateData.receiptUrl !== undefined) updateValues.receiptUrl = updateData.receiptUrl;
    if (updateData.notes !== undefined) updateValues.notes = updateData.notes;
    if (updateData.source !== undefined) updateValues.source = updateData.source;

    const [expense] = await db
      .update(expenses)
      .set(updateValues)
      .where(eq(expenses.id, id))
      .returning();
    
    return expense || undefined;
  }

  async deleteExpense(id: number): Promise<boolean> {
    const result = await db
      .delete(expenses)
      .where(eq(expenses.id, id))
      .returning();
    
    return result.length > 0;
  }

  async getCategoryTotals(userId: number, year: number, month: number): Promise<{ categoryId: number; categoryName: string; total: number; color: string; icon: string }[]> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const result = await db
      .select({
        categoryId: categories.id,
        categoryName: categories.name,
        color: categories.color,
        icon: categories.icon,
        total: sql<number>`sum(cast(${expenses.amount} as decimal))`.as('total'),
      })
      .from(expenses)
      .innerJoin(categories, eq(expenses.categoryId, categories.id))
      .where(
        and(
          eq(expenses.userId, userId),
          gte(expenses.date, startDate),
          lte(expenses.date, endDate)
        )
      )
      .groupBy(categories.id, categories.name, categories.color, categories.icon)
      .orderBy(desc(sql`sum(cast(${expenses.amount} as decimal))`));

    return result.map(row => ({
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      total: Number(row.total) || 0,
      color: row.color,
      icon: row.icon,
    }));
  }

  async getCategoryTotalsByPeriod(userId: number, period: 'day' | 'week' | 'month' | 'year', date: Date = new Date()): Promise<{ categoryId: number; categoryName: string; total: number; color: string; icon: string }[]> {
    let startDate: Date;
    let endDate: Date;

    const referenceDate = new Date(date);

    switch (period) {
      case 'day':
        startDate = new Date(referenceDate);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(referenceDate);
        endDate.setHours(23, 59, 59, 999);
        break;
      
      case 'week':
        startDate = new Date(referenceDate);
        startDate.setDate(referenceDate.getDate() - referenceDate.getDay());
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        break;
      
      case 'month':
        startDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
        endDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
      
      case 'year':
        startDate = new Date(referenceDate.getFullYear(), 0, 1);
        endDate = new Date(referenceDate.getFullYear(), 11, 31, 23, 59, 59, 999);
        break;
      
      default:
        throw new Error(`Invalid period: ${period}`);
    }

    const result = await db
      .select({
        categoryId: categories.id,
        categoryName: categories.name,
        color: categories.color,
        icon: categories.icon,
        total: sql<number>`sum(cast(${expenses.amount} as decimal))`.as('total'),
      })
      .from(expenses)
      .innerJoin(categories, eq(expenses.categoryId, categories.id))
      .where(
        and(
          eq(expenses.userId, userId),
          gte(expenses.date, startDate),
          lte(expenses.date, endDate)
        )
      )
      .groupBy(categories.id, categories.name, categories.color, categories.icon)
      .orderBy(desc(sql`sum(cast(${expenses.amount} as decimal))`));

    return result.map(row => ({
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      total: Number(row.total) || 0,
      color: row.color,
      icon: row.icon,
    }));
  }
}

export const storage = new DatabaseStorage();
