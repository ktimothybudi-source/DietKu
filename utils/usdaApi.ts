const USDA_API_KEY = process.env.EXPO_PUBLIC_USDA_API_KEY;
const USDA_BASE_URL = 'https://api.nal.usda.gov/fdc/v1';

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

export async function searchUSDAFoods(query: string, pageSize: number = 25): Promise<USDAFoodItem[]> {
  if (!USDA_API_KEY) {
    console.error('USDA API key not configured');
    throw new Error('USDA API key not configured');
  }

  if (!query.trim()) {
    return [];
  }

  try {
    console.log('Searching USDA for:', query);
    
    const response = await fetch(`${USDA_BASE_URL}/foods/search?api_key=${USDA_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: query.trim(),
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
