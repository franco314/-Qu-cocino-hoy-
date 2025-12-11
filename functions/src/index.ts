import {setGlobalOptions} from "firebase-functions/v2";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {GoogleGenAI, Type} from "@google/genai";
import {defineSecret} from "firebase-functions/params";

// Define secret for Gemini API key
const geminiApiKey = defineSecret("GEMINI_API_KEY");

setGlobalOptions({maxInstances: 10});

interface Recipe {
  id: string;
  title: string;
  description: string;
  preparationTime: string;
  difficulty: string;
  calories: number;
  ingredientsNeeded: string[];
  missingIngredients: string[];
  instructions: string[];
  imageUrl?: string;
}

// Helper function to generate an image for a recipe
const generateRecipeImage = async (
  ai: GoogleGenAI,
  title: string
): Promise<string | undefined> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [{
          text: `Fotografía gastronómica profesional, realista y muy apetitosa de un plato de ${title}. Iluminación de estudio, alta resolución, estilo revista de cocina, 4k. IMPORTANTE: Imagen limpia, SIN TEXTO, sin letras, sin tipografía, sin marcas de agua sobre la imagen. Solo comida.`,
        }],
      },
      config: {
        imageConfig: {
          aspectRatio: "4:3",
        },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
  } catch (error) {
    logger.warn(`No se pudo generar la imagen para "${title}":`, error);
    return undefined;
  }
  return undefined;
};

export const generateRecipes = onCall(
  {secrets: [geminiApiKey]},
  async (request) => {
    try {
      const {ingredients, useStrictMatching, excludeRecipes} = request.data;

      if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
        throw new HttpsError(
          "invalid-argument",
          "Se requiere una lista de ingredientes válida"
        );
      }

      const ai = new GoogleGenAI({apiKey: geminiApiKey.value()});
      const modelId = "gemini-2.5-flash";

      const ingredientsList = ingredients.join(", ");

      const strategyInstruction = useStrictMatching ?
      "MODO DESAFÍO ACTIVADO: El usuario requiere utilizar ABSOLUTAMENTE TODOS los ingredientes listados en cada receta. Es un ejercicio de creatividad culinaria. Solo podés omitir ingredientes si son condimentos obvios que no combinan. Buscá la forma de integrar todo." :
      "MODO FLEXIBLE: Utilizá los ingredientes listados como inspiración principal. Tu prioridad es que el plato sea delicioso y coherente. Si algún ingrediente no combina bien con el resto, omitilo sin problemas. Priorizá el sabor sobre la cantidad de ingredientes usados.";

      const exclusions = excludeRecipes && excludeRecipes.length > 0 ?
      `IMPORTANTE: El usuario ya vio las siguientes recetas, así que POR FAVOR GENERÁ OPCIONES COMPLETAMENTE DISTINTAS a estas: ${excludeRecipes.join(", ")}. Buscá variedad en métodos de cocción o perfiles de sabor.` :
      "";

      const prompt = `
      Actuá como un chef profesional. Tengo los siguientes ingredientes disponibles en mi cocina:

      Lista de ingredientes: ${ingredientsList}

      ${strategyInstruction}

      ${exclusions}

      Por favor, sugerime 3 recetas realizables y bien equilibradas.
      Si faltan ingredientes básicos de alacena (como sal, aceite, especias comunes), asumí que los tengo. Si falta algún ingrediente específico y clave para la receta, listalo en 'missingIngredients'.

      Redactá las instrucciones de manera clara, paso a paso y en español rioplatense (Argentina). El tono debe ser formal y educado.
      IMPORTANTE: Los títulos de las recetas deben respetar las reglas de ortografía del español: solo la primera letra en mayúscula (salvo nombres propios). Ejemplo: "Milanesas a la napolitana con puré" (Correcto), "Milanesas A La Napolitana Con Puré" (Incorrecto).
    `;

      // Generate Text Recipes
      const response = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
          systemInstruction: "Sos un asistente culinario experto. Generá recetas en español rioplatense (Argentina), utilizando vocabulario local correcto (ej: heladera, bife, morrón, manteca, crema). El tono debe ser profesional, formal y elegante. Mantené el voseo gramatical propio de Argentina pero evitá terminantemente el uso de lunfardo, muletillas informales (como 'che', 'viste') o expresiones coloquiales excesivas. Priorizá la claridad expositiva y la buena redacción. Asegurate de escribir los títulos con la capitalización correcta del español (Sentence case).",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: {type: Type.STRING, description: "Nombre de la receta (Solo primera letra mayúscula, resto minúsculas)"},
                description: {type: Type.STRING, description: "Breve descripción apetitosa y formal (max 20 palabras)"},
                preparationTime: {type: Type.STRING, description: "Tiempo estimado (ej. 30 min)"},
                difficulty: {type: Type.STRING, description: "Fácil, Media o Difícil"},
                calories: {type: Type.INTEGER, description: "Calorías estimadas por porción"},
                ingredientsNeeded: {
                  type: Type.ARRAY,
                  items: {type: Type.STRING},
                  description: "Lista completa de ingredientes con medidas estimadas",
                },
                missingIngredients: {
                  type: Type.ARRAY,
                  items: {type: Type.STRING},
                  description: "Ingredientes clave que el usuario no mencionó",
                },
                instructions: {
                  type: Type.ARRAY,
                  items: {type: Type.STRING},
                  description: "Pasos de preparación numerados, redactados formalmente",
                },
              },
              required: ["title", "description", "preparationTime", "difficulty", "ingredientsNeeded", "instructions"],
            },
          },
        },
      });

      if (response.text) {
        let rawData = response.text;

        // Clean JSON response
        rawData = rawData.replace(/```json\s*/g, "").replace(/```\s*/g, "");

        const firstBracket = rawData.indexOf("[");
        const lastBracket = rawData.lastIndexOf("]");

        if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
          rawData = rawData.substring(firstBracket, lastBracket + 1);
        }

        let rawRecipes: any[] = [];
        try {
          const parsed = JSON.parse(rawData);
          if (Array.isArray(parsed)) {
            rawRecipes = parsed;
          } else if (parsed && typeof parsed === "object") {
            if (Array.isArray((parsed as any).recipes)) {
              rawRecipes = (parsed as any).recipes;
            } else {
              rawRecipes = [parsed];
            }
          }
        } catch (e) {
          logger.error("JSON Parse error:", e);
          throw new HttpsError(
            "internal",
            "Error al procesar la respuesta del servidor"
          );
        }

        const recipesWithIds: Recipe[] = rawRecipes
          .filter((r: any) => r && typeof r === "object")
          .map((recipe: any) => ({
            id: Math.random().toString(36).substring(2) + Date.now().toString(36),
            title: String(recipe.title || "Receta sin título"),
            description: String(recipe.description || "Sin descripción disponible."),
            preparationTime: String(recipe.preparationTime || "-- min"),
            difficulty: String(recipe.difficulty || "Media"),
            calories: typeof recipe.calories === "number" ? recipe.calories : 0,
            ingredientsNeeded: Array.isArray(recipe.ingredientsNeeded) ?
            recipe.ingredientsNeeded.map(String) :
            [],
            missingIngredients: Array.isArray(recipe.missingIngredients) ?
            recipe.missingIngredients.map(String) :
            [],
            instructions: Array.isArray(recipe.instructions) ?
            recipe.instructions.map(String) :
            [],
            imageUrl: undefined,
          }));

        if (recipesWithIds.length === 0) {
          throw new HttpsError(
            "internal",
            "No se pudieron interpretar las recetas"
          );
        }

        // Generate Images in parallel
        const recipesWithImages = await Promise.all(
          recipesWithIds.map(async (recipe) => {
            const imageUrl = await generateRecipeImage(ai, recipe.title);
            return {...recipe, imageUrl};
          })
        );

        return {recipes: recipesWithImages};
      }

      throw new HttpsError("internal", "No se recibieron recetas");
    } catch (error: any) {
      logger.error("Error generating recipes:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", "Error interno del servidor");
    }
  }
);
