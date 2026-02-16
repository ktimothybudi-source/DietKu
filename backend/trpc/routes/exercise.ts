import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../create-context";
import { supabase } from "../../lib/supabase";

export const exerciseRouter = createTRPCRouter({
  // Get exercise entries for a date range
  getExercises: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        startDate: z.string(),
        endDate: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      let query = supabase
        .from("exercise_entries")
        .select("*")
        .eq("user_id", input.userId)
        .gte("date", input.startDate)
        .order("created_at", { ascending: false });

      if (input.endDate) {
        query = query.lte("date", input.endDate);
      }

      const { data, error } = await query;

      if (error) throw new Error(error.message);
      return data || [];
    }),

  // Create an exercise entry
  createExercise: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        date: z.string(),
        type: z.enum(["quick", "describe", "manual", "steps"]),
        name: z.string(),
        caloriesBurned: z.number(),
        duration: z.number().optional(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { data, error } = await supabase
        .from("exercise_entries")
        .insert({
          user_id: input.userId,
          date: input.date,
          type: input.type,
          name: input.name,
          calories_burned: input.caloriesBurned,
          duration: input.duration,
          description: input.description,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    }),

  // Delete an exercise entry
  deleteExercise: publicProcedure
    .input(z.object({ userId: z.string(), exerciseId: z.string() }))
    .mutation(async ({ input }) => {
      const { error } = await supabase
        .from("exercise_entries")
        .delete()
        .eq("id", input.exerciseId)
        .eq("user_id", input.userId);

      if (error) throw new Error(error.message);
      return { success: true };
    }),

  // Get steps data for a date range
  getSteps: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        startDate: z.string(),
        endDate: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      let query = supabase
        .from("steps_data")
        .select("*")
        .eq("user_id", input.userId)
        .gte("date", input.startDate)
        .order("date", { ascending: true });

      if (input.endDate) {
        query = query.lte("date", input.endDate);
      }

      const { data, error } = await query;

      if (error) throw new Error(error.message);
      return data || [];
    }),

  // Upsert steps data for a date
  upsertSteps: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        date: z.string(),
        steps: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const { data, error } = await supabase
        .from("steps_data")
        .upsert(
          {
            user_id: input.userId,
            date: input.date,
            steps: input.steps,
          },
          { onConflict: "user_id,date" }
        )
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    }),
});
