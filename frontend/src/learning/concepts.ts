import { CONCEPT_IDS, type LanguageConcept } from "./models";

/** Meaning and skill goals are shared by every target language. Descriptions read as "you can …". */
export const chapterOneConcepts: LanguageConcept[] = [
  { id: CONCEPT_IDS.GREETING, description: "Greet someone", modalities: ["listening", "speaking"] },
  { id: CONCEPT_IDS.INTRODUCE_SELF, description: "Introduce yourself", modalities: ["listening", "speaking"] },
  { id: CONCEPT_IDS.BASIC_QUESTION, description: "Understand a simple question", modalities: ["listening"] },
  { id: CONCEPT_IDS.ORDER_ITEM, description: "Order something", modalities: ["listening", "speaking"] },
  { id: CONCEPT_IDS.POLITE_REQUEST, description: "Ask politely", modalities: ["listening", "speaking"] },
  { id: CONCEPT_IDS.NUMBERS_1_10, description: "Recognise small numbers", modalities: ["listening"] },
  { id: CONCEPT_IDS.UNDERSTAND_PRICE, description: "Understand a price", modalities: ["listening"] },
  { id: CONCEPT_IDS.THANK_PERSON, description: "Thank someone", modalities: ["listening", "speaking"] },
  { id: CONCEPT_IDS.YES_NO, description: "Understand yes and no", modalities: ["listening"] },
  { id: CONCEPT_IDS.FAREWELL, description: "Say goodbye", modalities: ["listening", "speaking"] }
];
