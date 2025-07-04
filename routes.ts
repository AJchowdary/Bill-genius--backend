import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertExpenseSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Mock user for demonstration (in a real app, this would come from authentication)
  const MOCK_USER_ID = 1;

  // Categories routes
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getAllCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  // Expenses routes
  app.get("/api/expenses", async (req, res) => {
    try {
      const { year, month } = req.query;
      
      if (year && month) {
        const expenses = await storage.getExpensesByUserIdAndMonth(
          MOCK_USER_ID, 
          parseInt(year as string), 
          parseInt(month as string)
        );
        res.json(expenses);
      } else {
        const expenses = await storage.getExpensesByUserId(MOCK_USER_ID);
        res.json(expenses);
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch expenses" });
    }
  });

  app.post("/api/expenses", async (req, res) => {
    try {
      const validatedData = insertExpenseSchema.parse({
        ...req.body,
        userId: MOCK_USER_ID,
      });

      const expense = await storage.createExpense(validatedData);
      res.status(201).json(expense);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid expense data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create expense" });
      }
    }
  });

  app.put("/api/expenses/:id", async (req, res) => {
    try {
      const expenseId = parseInt(req.params.id);
      const validatedData = insertExpenseSchema.partial().parse(req.body);

      const expense = await storage.updateExpense(expenseId, validatedData);
      if (!expense) {
        res.status(404).json({ error: "Expense not found" });
        return;
      }

      res.json(expense);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid expense data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to update expense" });
      }
    }
  });

  app.delete("/api/expenses/:id", async (req, res) => {
    try {
      const expenseId = parseInt(req.params.id);
      const deleted = await storage.deleteExpense(expenseId);
      
      if (!deleted) {
        res.status(404).json({ error: "Expense not found" });
        return;
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete expense" });
    }
  });

  // Analytics routes
  app.get("/api/analytics/category-totals", async (req, res) => {
    try {
      const { year, month, period, date } = req.query;
      
      if (period) {
        const referenceDate = date ? new Date(date as string) : new Date();
        const categoryTotals = await storage.getCategoryTotalsByPeriod(MOCK_USER_ID, period as 'day' | 'week' | 'month' | 'year', referenceDate);
        res.json(categoryTotals);
      } else {
        const currentYear = year ? parseInt(year as string) : new Date().getFullYear();
        const currentMonth = month ? parseInt(month as string) : new Date().getMonth() + 1;
        const categoryTotals = await storage.getCategoryTotals(MOCK_USER_ID, currentYear, currentMonth);
        res.json(categoryTotals);
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch category totals" });
    }
  });

  app.get("/api/analytics/monthly-summary", async (req, res) => {
    try {
      const { year, month, period, date } = req.query;
      
      if (period) {
        const referenceDate = date ? new Date(date as string) : new Date();
        const expenses = await storage.getExpensesByUserIdAndPeriod(MOCK_USER_ID, period as 'day' | 'week' | 'month' | 'year', referenceDate);
        const total = expenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);
        
        // Calculate previous period for comparison
        let prevDate = new Date(referenceDate);
        switch (period) {
          case 'day':
            prevDate.setDate(prevDate.getDate() - 1);
            break;
          case 'week':
            prevDate.setDate(prevDate.getDate() - 7);
            break;
          case 'month':
            prevDate.setMonth(prevDate.getMonth() - 1);
            break;
          case 'year':
            prevDate.setFullYear(prevDate.getFullYear() - 1);
            break;
        }
        
        const prevExpenses = await storage.getExpensesByUserIdAndPeriod(MOCK_USER_ID, period as 'day' | 'week' | 'month' | 'year', prevDate);
        const prevTotal = prevExpenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);
        const changePercent = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : 0;

        res.json({
          total,
          expenseCount: expenses.length,
          changePercent: Math.round(changePercent * 100) / 100,
          budget: 3000, // Mock budget
          period,
          date: referenceDate.toISOString(),
        });
      } else {
        const currentYear = year ? parseInt(year as string) : new Date().getFullYear();
        const currentMonth = month ? parseInt(month as string) : new Date().getMonth() + 1;

        const expenses = await storage.getExpensesByUserIdAndMonth(MOCK_USER_ID, currentYear, currentMonth);
        const total = expenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);
        
        // Calculate previous month for comparison
        const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
        const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
        const prevExpenses = await storage.getExpensesByUserIdAndMonth(MOCK_USER_ID, prevYear, prevMonth);
        const prevTotal = prevExpenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);
        
        const changePercent = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : 0;

        res.json({
          total,
          expenseCount: expenses.length,
          changePercent: Math.round(changePercent * 100) / 100,
          budget: 3000, // Mock budget
          month: currentMonth,
          year: currentYear,
        });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch summary" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
