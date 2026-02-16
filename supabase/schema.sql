-- Rork Dietku Clone Database Schema
-- Run this in Supabase SQL Editor to create all required tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  name TEXT,
  gender TEXT CHECK (gender IN ('male', 'female')),
  birth_date DATE,
  height NUMERIC(5,2),
  weight NUMERIC(5,2),
  target_weight NUMERIC(5,2),
  activity_level TEXT CHECK (activity_level IN ('low', 'moderate', 'high')),
  goal TEXT CHECK (goal IN ('fat_loss', 'maintenance', 'muscle_gain')),
  daily_calories INTEGER,
  protein_target NUMERIC(5,2),
  carbs_target NUMERIC(5,2),
  fat_target NUMERIC(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Food entries table
CREATE TABLE IF NOT EXISTS food_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  meal_type TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  food_name TEXT NOT NULL,
  calories NUMERIC(7,2) NOT NULL,
  protein NUMERIC(7,2) NOT NULL DEFAULT 0,
  carbs NUMERIC(7,2) NOT NULL DEFAULT 0,
  fat NUMERIC(7,2) NOT NULL DEFAULT 0,
  photo_uri TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Weight history table
CREATE TABLE IF NOT EXISTS weight_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weight NUMERIC(5,2) NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Food database table (for food search)
CREATE TABLE IF NOT EXISTS food (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  calories NUMERIC(7,2) NOT NULL,
  proteins NUMERIC(7,2) NOT NULL DEFAULT 0,
  fat NUMERIC(7,2) NOT NULL DEFAULT 0,
  carbohydrate NUMERIC(7,2) NOT NULL DEFAULT 0,
  image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Exercise entries table
CREATE TABLE IF NOT EXISTS exercise_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('quick', 'describe', 'manual', 'steps')),
  name TEXT NOT NULL,
  calories_burned INTEGER NOT NULL DEFAULT 0,
  duration INTEGER,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Steps data table
CREATE TABLE IF NOT EXISTS steps_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  steps INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Community profiles table
CREATE TABLE IF NOT EXISTS community_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  avatar_color TEXT NOT NULL,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Community groups table
CREATE TABLE IF NOT EXISTS community_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  cover_image TEXT,
  invite_code TEXT UNIQUE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Community group members table
CREATE TABLE IF NOT EXISTS community_group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- Community posts table
CREATE TABLE IF NOT EXISTS community_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id UUID REFERENCES community_groups(id) ON DELETE CASCADE,
  caption TEXT,
  meal_type TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  food_name TEXT NOT NULL,
  calories NUMERIC(7,2) NOT NULL,
  protein NUMERIC(7,2) NOT NULL DEFAULT 0,
  carbs NUMERIC(7,2) NOT NULL DEFAULT 0,
  fat NUMERIC(7,2) NOT NULL DEFAULT 0,
  photo_uri TEXT,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Community post likes table
CREATE TABLE IF NOT EXISTS community_post_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- Community comments table
CREATE TABLE IF NOT EXISTS community_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Favorites table
CREATE TABLE IF NOT EXISTS favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  calories NUMERIC(7,2) NOT NULL,
  protein NUMERIC(7,2) NOT NULL DEFAULT 0,
  carbs NUMERIC(7,2) NOT NULL DEFAULT 0,
  fat NUMERIC(7,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recent meals table
CREATE TABLE IF NOT EXISTS recent_meals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  calories NUMERIC(7,2) NOT NULL,
  protein NUMERIC(7,2) NOT NULL DEFAULT 0,
  carbs NUMERIC(7,2) NOT NULL DEFAULT 0,
  fat NUMERIC(7,2) NOT NULL DEFAULT 0,
  last_logged_at TIMESTAMPTZ DEFAULT NOW()
);

-- Water tracking table
CREATE TABLE IF NOT EXISTS water_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  cups INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Micronutrients tracking table
CREATE TABLE IF NOT EXISTS micronutrients_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  sugar_units NUMERIC(5,2) DEFAULT 0,
  fiber_units NUMERIC(5,2) DEFAULT 0,
  sodium_units INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_food_entries_user_date ON food_entries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_food_entries_user_id ON food_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_weight_history_user_id ON weight_history(user_id);
CREATE INDEX IF NOT EXISTS idx_exercise_entries_user_date ON exercise_entries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_steps_data_user_date ON steps_data(user_id, date);
CREATE INDEX IF NOT EXISTS idx_community_posts_group_id ON community_posts(group_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_user_id ON community_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_community_group_members_group_id ON community_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_community_group_members_user_id ON community_group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_food_name ON food(name);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_community_groups_updated_at BEFORE UPDATE ON community_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_community_profiles_updated_at BEFORE UPDATE ON community_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_community_posts_updated_at BEFORE UPDATE ON community_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_community_comments_updated_at BEFORE UPDATE ON community_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_food_updated_at BEFORE UPDATE ON food
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_steps_data_updated_at BEFORE UPDATE ON steps_data
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_water_tracking_updated_at BEFORE UPDATE ON water_tracking
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_micronutrients_tracking_updated_at BEFORE UPDATE ON micronutrients_tracking
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
