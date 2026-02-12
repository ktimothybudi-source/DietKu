const USDA_API_KEY = process.env.EXPO_PUBLIC_USDA_API_KEY;
const USDA_BASE_URL = 'https://api.nal.usda.gov/fdc/v1';
const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

export interface USDAFoodItem {
  fdcId: number;
  description: string;
  brandName?: string;
  brandOwner?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface USDANutrient {
  nutrientId: number;
  nutrientName: string;
  nutrientNumber: string;
  unitName: string;
  value: number;
}

interface USDASearchFood {
  fdcId: number;
  description: string;
  dataType: string;
  brandName?: string;
  brandOwner?: string;
  foodNutrients: USDANutrient[];
  servingSize?: number;
  servingSizeUnit?: string;
}

interface USDASearchResponse {
  foods: USDASearchFood[];
  totalHits: number;
  currentPage: number;
  totalPages: number;
}

function extractNutrientValue(nutrients: USDANutrient[], nutrientNumber: string): number {
  const nutrient = nutrients.find(n => n.nutrientNumber === nutrientNumber);
  return nutrient ? Math.round(nutrient.value) : 0;
}

async function translateToEnglish(indonesianQuery: string): Promise<string> {
  if (!OPENAI_API_KEY) {
    console.warn('OpenAI API key not configured, returning original query');
    return indonesianQuery;
  }

  try {
    console.log('Translating to English:', indonesianQuery);
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a food translator. Translate Indonesian food names to English. Only return the English translation, nothing else. If the input is already in English, return it as is.',
          },
          {
            role: 'user',
            content: indonesianQuery,
          },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.error('OpenAI translation error:', response.status);
      return indonesianQuery;
    }

    const data = await response.json();
    const translation = data.choices[0]?.message?.content?.trim() || indonesianQuery;
    console.log('Translated to:', translation);
    return translation;
  } catch (error) {
    console.error('Error translating:', error);
    return indonesianQuery;
  }
}

async function rankUSDAResults(originalQuery: string, results: USDAFoodItem[]): Promise<USDAFoodItem[]> {
  if (!OPENAI_API_KEY || results.length === 0) {
    return results;
  }

  try {
    console.log('Ranking USDA results for:', originalQuery);
    const resultDescriptions = results.map((r, idx) => 
      `${idx + 1}. ${r.description}${r.brandName ? ` (${r.brandName})` : ''}`
    ).join('\n');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a food matching expert. Given a food query and a list of USDA foods, rank them by relevance. Return ONLY a comma-separated list of numbers (e.g., "3,1,5,2,4") representing the ranking from most to least relevant. No explanation.',
          },
          {
            role: 'user',
            content: `Query: "${originalQuery}"\n\nFoods:\n${resultDescriptions}\n\nRank these by relevance:`,
          },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.error('OpenAI ranking error:', response.status);
      return results;
    }

    const data = await response.json();
    const ranking = data.choices[0]?.message?.content?.trim();
    
    if (!ranking) {
      return results;
    }

    const rankedIndices = ranking.split(',').map((n: string) => parseInt(n.trim()) - 1).filter((n: number) => !isNaN(n) && n >= 0 && n < results.length);
    console.log('AI ranking:', rankedIndices);
    
    const rankedResults = rankedIndices.map((idx: number) => results[idx]);
    const unranked = results.filter((_, idx) => !rankedIndices.includes(idx));
    
    return [...rankedResults, ...unranked];
  } catch (error) {
    console.error('Error ranking results:', error);
    return results;
  }
}

function detectLanguage(query: string): 'id' | 'en' {
  const indonesianWords = ['nasi', 'ayam', 'goreng', 'tempe', 'tahu', 'sate', 'rendang', 'gado', 'mie', 'bakso', 'sambal', 'kerupuk', 'ikan', 'soto', 'sop', 'sayur', 'lauk', 'buah', 'telur', 'daging', 'bebek', 'kambing', 'udang', 'cumi', 'kepiting', 'kangkung', 'bayam', 'wortel', 'kentang', 'jagung', 'pisang', 'mangga', 'jeruk', 'apel', 'roti', 'kue', 'kopi', 'teh', 'susu', 'air'];
  const lowerQuery = query.toLowerCase();
  const hasIndonesianWord = indonesianWords.some(word => lowerQuery.includes(word));
  return hasIndonesianWord ? 'id' : 'en';
}

export async function searchUSDAFoods(query: string, pageSize: number = 25): Promise<USDAFoodItem[]> {
  if (!USDA_API_KEY) {
    console.error('USDA API key not configured');
    throw new Error('USDA API key not configured');
  }

  if (!query.trim()) {
    return [];
  }

  try {
    const language = detectLanguage(query);
    console.log('Detected language:', language);
    
    let searchQuery = query;
    if (language === 'id') {
      searchQuery = await translateToEnglish(query);
    }
    
    console.log('Searching USDA for:', searchQuery);
    
    const response = await fetch(`${USDA_BASE_URL}/foods/search?api_key=${USDA_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: searchQuery.trim(),
        pageSize,
        dataType: ['Foundation', 'SR Legacy', 'Branded'],
        sortBy: 'dataType.keyword',
        sortOrder: 'asc',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('USDA API error:', response.status, errorText);
      throw new Error(`USDA API error: ${response.status}`);
    }

    const data: USDASearchResponse = await response.json();
    console.log('USDA search results:', data.totalHits, 'hits');

    const foods: USDAFoodItem[] = data.foods.map((food) => ({
      fdcId: food.fdcId,
      description: food.description,
      brandName: food.brandName,
      brandOwner: food.brandOwner,
      servingSize: food.servingSize,
      servingSizeUnit: food.servingSizeUnit,
      calories: extractNutrientValue(food.foodNutrients, '208'),
      protein: extractNutrientValue(food.foodNutrients, '203'),
      carbs: extractNutrientValue(food.foodNutrients, '205'),
      fat: extractNutrientValue(food.foodNutrients, '204'),
    }));

    if (language === 'id' && foods.length > 0) {
      const rankedFoods = await rankUSDAResults(query, foods);
      return rankedFoods;
    }

    return foods;
  } catch (error) {
    console.error('Error searching USDA foods:', error);
    throw error;
  }
}

export async function getUSDAFoodDetails(fdcId: number): Promise<USDAFoodItem | null> {
  if (!USDA_API_KEY) {
    console.error('USDA API key not configured');
    return null;
  }

  try {
    console.log('Getting USDA food details for:', fdcId);
    
    const response = await fetch(
      `${USDA_BASE_URL}/food/${fdcId}?api_key=${USDA_API_KEY}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error('USDA API error:', response.status);
      return null;
    }

    const food = await response.json();
    
    const nutrients = food.foodNutrients || [];
    
    return {
      fdcId: food.fdcId,
      description: food.description,
      brandName: food.brandName,
      brandOwner: food.brandOwner,
      servingSize: food.servingSize,
      servingSizeUnit: food.servingSizeUnit,
      calories: extractNutrientValue(nutrients, '208'),
      protein: extractNutrientValue(nutrients, '203'),
      carbs: extractNutrientValue(nutrients, '205'),
      fat: extractNutrientValue(nutrients, '204'),
    };
  } catch (error) {
    console.error('Error getting USDA food details:', error);
    return null;
  }
}
