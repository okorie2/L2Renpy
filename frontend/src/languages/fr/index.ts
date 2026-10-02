import { PLAYER_SPEAKER_ID } from "../../dialogue/models";
import { CONCEPT_IDS } from "../../learning/models";
import type { LanguagePack } from "../types";

export const french: LanguagePack = {
  code: "fr",
  name: "French",
  ui: { interact: "Parler à" },
  placeLabels: {
    cafe: "CAFÉ",
    bakery: "BOULANGERIE",
    apartment: "APPARTEMENT"
  },
  conceptExpressions: {
    [CONCEPT_IDS.GREETING]: ["Salut !", "Bonjour !"],
    [CONCEPT_IDS.FAREWELL]: ["Au revoir !", "À bientôt !", "Bonne journée !"],
    [CONCEPT_IDS.INTRODUCE_SELF]: ["Je m'appelle…", "Moi, c'est…"],
    [CONCEPT_IDS.BASIC_QUESTION]: ["Comment tu t'appelles ?", "Vous désirez ?", "Ça va ?"],
    [CONCEPT_IDS.YES_NO]: ["Oui.", "Non."],
    [CONCEPT_IDS.POLITE_REQUEST]: ["S'il vous plaît."],
    [CONCEPT_IDS.THANK_PERSON]: ["Merci !"],
    [CONCEPT_IDS.ORDER_ITEM]: ["Je voudrais un café, s'il vous plaît.", "Un café, s'il vous plaît."],
    [CONCEPT_IDS.NUMBERS_1_10]: ["un", "deux", "trois"],
    [CONCEPT_IDS.UNDERSTAND_PRICE]: ["Ça fait trois euros."]
  },
  vocabulary: [
    {
      id: "fr.salut", lemma: "salut", surfaceForms: ["salut"], gloss: "hi", partOfSpeech: "interjection",
      conceptIds: [CONCEPT_IDS.GREETING],
      examples: [{ target: "Salut ! Ça va ?", translation: "Hi! How's it going?" }],
      introducedIn: { chapter: 1, dialogueId: "meetSophie" }
    },
    {
      id: "fr.sappeler", lemma: "s'appeler", surfaceForms: ["je m'appelle", "tu t'appelles"], gloss: "to be called", partOfSpeech: "verb",
      conceptIds: [CONCEPT_IDS.INTRODUCE_SELF],
      examples: [{ target: "Je m'appelle Sophie.", translation: "My name is Sophie." }],
      introducedIn: { chapter: 1, dialogueId: "meetSophie" }
    },
    {
      id: "fr.enchante", lemma: "enchanté", surfaceForms: ["enchanté", "enchantée"], gloss: "nice to meet you", partOfSpeech: "adjective",
      conceptIds: [CONCEPT_IDS.GREETING],
      examples: [{ target: "Enchantée !", translation: "Nice to meet you!" }],
      introducedIn: { chapter: 1, dialogueId: "meetSophie" }
    },
    {
      id: "fr.pardon", lemma: "pardon", surfaceForms: ["pardon"], gloss: "sorry? / excuse me", partOfSpeech: "interjection",
      conceptIds: [CONCEPT_IDS.BASIC_QUESTION],
      examples: [{ target: "Pardon ?", translation: "Sorry?" }],
      introducedIn: { chapter: 1, dialogueId: "meetSophie" }
    },
    {
      id: "fr.cafe", lemma: "café", surfaceForms: ["café"], gloss: "coffee; café", partOfSpeech: "noun",
      conceptIds: [CONCEPT_IDS.ORDER_ITEM],
      examples: [{ target: "Un café, s'il vous plaît.", translation: "A coffee, please." }],
      introducedIn: { chapter: 1, dialogueId: "sophieToCafe" }
    },
    {
      id: "fr.bonjour", lemma: "bonjour", surfaceForms: ["bonjour"], gloss: "hello", partOfSpeech: "interjection",
      conceptIds: [CONCEPT_IDS.GREETING],
      examples: [{ target: "Bonjour ! Vous désirez ?", translation: "Hello! What would you like?" }],
      introducedIn: { chapter: 1, dialogueId: "cafeOrder" }
    },
    {
      id: "fr.desirer", lemma: "désirer", surfaceForms: ["vous désirez"], gloss: "to want (what would you like?)", partOfSpeech: "verb",
      conceptIds: [CONCEPT_IDS.BASIC_QUESTION, CONCEPT_IDS.ORDER_ITEM],
      examples: [{ target: "Vous désirez ?", translation: "What would you like?" }],
      introducedIn: { chapter: 1, dialogueId: "cafeOrder" }
    },
    {
      id: "fr.jevoudrais", lemma: "je voudrais", surfaceForms: ["je voudrais"], gloss: "I would like", partOfSpeech: "phrase",
      conceptIds: [CONCEPT_IDS.ORDER_ITEM, CONCEPT_IDS.POLITE_REQUEST],
      examples: [{ target: "Je voudrais un café.", translation: "I would like a coffee." }],
      introducedIn: { chapter: 1, dialogueId: "cafeOrder" }
    },
    {
      id: "fr.silvousplait", lemma: "s'il vous plaît", surfaceForms: ["s'il vous plaît", "s'il te plaît", "svp"], gloss: "please", partOfSpeech: "phrase",
      conceptIds: [CONCEPT_IDS.POLITE_REQUEST],
      examples: [{ target: "Un croissant, s'il vous plaît.", translation: "A croissant, please." }],
      introducedIn: { chapter: 1, dialogueId: "cafeOrder" }
    },
    {
      id: "fr.trois", lemma: "trois", surfaceForms: ["trois"], gloss: "three", partOfSpeech: "number",
      conceptIds: [CONCEPT_IDS.NUMBERS_1_10],
      examples: [{ target: "Ça fait trois euros.", translation: "That's three euros." }],
      introducedIn: { chapter: 1, dialogueId: "cafeOrder" }
    },
    {
      id: "fr.euro", lemma: "euro", surfaceForms: ["euro", "euros"], gloss: "euro", partOfSpeech: "noun",
      conceptIds: [CONCEPT_IDS.UNDERSTAND_PRICE],
      examples: [{ target: "Un euro, s'il vous plaît.", translation: "One euro, please." }],
      introducedIn: { chapter: 1, dialogueId: "cafeOrder" }
    },
    {
      id: "fr.merci", lemma: "merci", surfaceForms: ["merci"], gloss: "thank you", partOfSpeech: "interjection",
      conceptIds: [CONCEPT_IDS.THANK_PERSON],
      examples: [{ target: "Merci, bonne journée !", translation: "Thank you, have a nice day!" }],
      introducedIn: { chapter: 1, dialogueId: "cafeOrder" }
    },
    {
      id: "fr.bonnejournee", lemma: "bonne journée", surfaceForms: ["bonne journée"], gloss: "have a nice day", partOfSpeech: "phrase",
      conceptIds: [CONCEPT_IDS.FAREWELL],
      examples: [{ target: "Au revoir, bonne journée !", translation: "Goodbye, have a nice day!" }],
      introducedIn: { chapter: 1, dialogueId: "cafeOrder" }
    },
    {
      id: "fr.non", lemma: "non", surfaceForms: ["non"], gloss: "no", partOfSpeech: "interjection",
      conceptIds: [CONCEPT_IDS.YES_NO],
      examples: [{ target: "Non, non. Trois euros.", translation: "No, no. Three euros." }],
      introducedIn: { chapter: 1, dialogueId: "cafeOrder" }
    },
    {
      id: "fr.croissant", lemma: "croissant", surfaceForms: ["croissant", "croissants"], gloss: "croissant", partOfSpeech: "noun",
      conceptIds: [CONCEPT_IDS.ORDER_ITEM],
      examples: [{ target: "Un croissant, s'il vous plaît.", translation: "A croissant, please." }],
      introducedIn: { chapter: 1, dialogueId: "bakeryOrder" }
    },
    {
      id: "fr.aurevoir", lemma: "au revoir", surfaceForms: ["au revoir"], gloss: "goodbye", partOfSpeech: "phrase",
      conceptIds: [CONCEPT_IDS.FAREWELL],
      examples: [{ target: "Merci, au revoir !", translation: "Thank you, goodbye!" }],
      introducedIn: { chapter: 1, dialogueId: "bakeryOrder" }
    },
    {
      id: "fr.bienvenue", lemma: "bienvenue", surfaceForms: ["bienvenue"], gloss: "welcome", partOfSpeech: "interjection",
      conceptIds: [CONCEPT_IDS.GREETING],
      examples: [{ target: "Bienvenue dans le quartier !", translation: "Welcome to the neighborhood!" }],
      introducedIn: { chapter: 1, dialogueId: "meetNeighbor" }
    },
    {
      id: "fr.cava", lemma: "ça va", surfaceForms: ["ça va"], gloss: "how's it going? / I'm fine", partOfSpeech: "phrase",
      conceptIds: [CONCEPT_IDS.GREETING, CONCEPT_IDS.BASIC_QUESTION],
      examples: [{ target: "Salut ! Ça va ?", translation: "Hi! How's it going?" }],
      introducedIn: { chapter: 1, dialogueId: "sophieAfterErrands" }
    },
    {
      id: "fr.abientot", lemma: "à bientôt", surfaceForms: ["à bientôt"], gloss: "see you soon", partOfSpeech: "phrase",
      conceptIds: [CONCEPT_IDS.FAREWELL],
      examples: [{ target: "À bientôt !", translation: "See you soon!" }],
      introducedIn: { chapter: 1, dialogueId: "sophieAfterErrands" }
    },
    {
      id: "fr.oui", lemma: "oui", surfaceForms: ["oui"], gloss: "yes", partOfSpeech: "interjection",
      conceptIds: [CONCEPT_IDS.YES_NO],
      examples: [{ target: "Oui, avec plaisir !", translation: "Yes, gladly!" }],
      introducedIn: { chapter: 1, dialogueId: "sophieMessage" }
    },
    {
      id: "fr.demain", lemma: "demain", surfaceForms: ["demain"], gloss: "tomorrow", partOfSpeech: "noun",
      conceptIds: [CONCEPT_IDS.BASIC_QUESTION],
      examples: [{ target: "Tu veux aller au café demain ?", translation: "Do you want to go to the café tomorrow?" }],
      introducedIn: { chapter: 1, dialogueId: "sophieMessage" }
    }
  ],
  intents: {
    greetSophie: {
      id: "greetSophie",
      conceptId: CONCEPT_IDS.GREETING,
      modality: "speaking",
      prompt: "Salue Sophie.",
      meaning: "Greet Sophie (say hello).",
      acceptedExpressions: ["Salut !", "Bonjour !", "Salut, Sophie !"],
      match: [["salut"], ["bonjour"], ["coucou"]]
    },
    introduceSelf: {
      id: "introduceSelf",
      conceptId: CONCEPT_IDS.INTRODUCE_SELF,
      modality: "speaking",
      prompt: "Présente-toi.",
      meaning: "Say what their own name is, in a sentence.",
      acceptedExpressions: ["Je m'appelle…", "Moi, c'est…", "Je suis…"],
      match: [["je m'appelle"], ["moi c'est"], ["je suis"], ["mon nom est"]]
    },
    greet: {
      id: "greet",
      conceptId: CONCEPT_IDS.GREETING,
      modality: "speaking",
      prompt: "Dis bonjour.",
      meaning: "Greet the other person (say hello).",
      acceptedExpressions: ["Bonjour !", "Bonjour, madame !", "Bonjour, monsieur !"],
      match: [["bonjour"], ["bonsoir"], ["salut"]]
    },
    orderDrink: {
      id: "orderDrink",
      conceptId: CONCEPT_IDS.ORDER_ITEM,
      modality: "speaking",
      prompt: "Commande un café.",
      meaning: "Order a coffee (any kind of coffee, but not another drink).",
      acceptedExpressions: ["Je voudrais un café, s'il vous plaît.", "Un café, s'il vous plaît.", "Un café, s'il te plaît."],
      match: [["café"]]
    },
    orderPastry: {
      id: "orderPastry",
      conceptId: CONCEPT_IDS.ORDER_ITEM,
      modality: "speaking",
      prompt: "Demande un croissant.",
      meaning: "Ask for a croissant (not another pastry).",
      acceptedExpressions: ["Un croissant, s'il vous plaît.", "Je voudrais un croissant, s'il vous plaît."],
      match: [["croissant"]]
    },
    sayHowYouAre: {
      id: "sayHowYouAre",
      conceptId: CONCEPT_IDS.BASIC_QUESTION,
      modality: "writing",
      prompt: "Réponds à « Ça va ? ».",
      meaning: "Answer the question \"how are you?\" (fine, well, not great, tired, and so on).",
      acceptedExpressions: ["Ça va bien, merci !", "Ça va.", "Très bien !"],
      match: [["ça va"], ["bien"], ["pas mal"]]
    },
    answerYesNo: {
      id: "answerYesNo",
      conceptId: CONCEPT_IDS.YES_NO,
      modality: "writing",
      prompt: "Réponds oui ou non.",
      meaning: "Accept or decline the invitation (yes or no, in any polite form).",
      acceptedExpressions: ["Oui, avec plaisir !", "Oui !", "Non, merci."],
      match: [["oui"], ["non"], ["d'accord"], ["avec plaisir"]]
    },
    thankPerson: {
      id: "thankPerson",
      conceptId: CONCEPT_IDS.THANK_PERSON,
      modality: "speaking",
      prompt: "Dis merci.",
      meaning: "Thank the other person.",
      acceptedExpressions: ["Merci !", "Merci beaucoup !", "Merci, au revoir !"],
      match: [["merci"]]
    }
  },
  slots: {
    playerName: { source: "profile", field: "displayName", fallback: { target: "toi", translation: "you" } },
    motivationPhrase: {
      source: "profile-lookup",
      field: "motivation",
      fallbackOption: "curiosity",
      options: {
        travel: { target: "pour voyager", translation: "to travel" },
        work: { target: "pour le travail", translation: "for work" },
        study: { target: "pour mes études", translation: "for my studies" },
        people: { target: "pour parler avec mes proches", translation: "to talk with the people close to me" },
        curiosity: { target: "pour le plaisir", translation: "for fun" }
      }
    }
  },
  dialogues: {
    meetSophie: {
      id: "meetSophie",
      startNodeId: "hello",
      nodes: {
        hello: {
          id: "hello",
          speakerId: "sophie",
          targetText: "Salut ! Je m'appelle Sophie.",
          translation: "Hi! My name is Sophie.",
          nextNodeId: "askName",
          conceptIds: [CONCEPT_IDS.GREETING, CONCEPT_IDS.INTRODUCE_SELF],
          presentation: { expression: "neutral" }
        },
        askName: {
          id: "askName",
          speakerId: "sophie",
          targetText: "Et toi, comment tu t'appelles ?",
          translation: "And you, what's your name?",
          nextNodeId: "niceToMeet",
          conceptIds: [CONCEPT_IDS.INTRODUCE_SELF, CONCEPT_IDS.BASIC_QUESTION],
          presentation: { expression: "question" },
          hint: "Je m'appelle ____.",
          response: {
            kind: "text",
            saveTo: "displayName",
            label: "Your name or a nickname",
            note: "A nickname is fine. It stays on this device."
          }
        },
        niceToMeet: {
          id: "niceToMeet",
          speakerId: "sophie",
          targetText: "Enchantée, {playerName} !",
          translation: "Nice to meet you, {playerName}!",
          nextNodeId: "askExperience",
          conceptIds: [CONCEPT_IDS.GREETING],
          presentation: { expression: "happy" }
        },
        askExperience: {
          id: "askExperience",
          speakerId: "sophie",
          targetText: "Tu parles déjà un peu français ?",
          translation: "Do you already speak a little French?",
          nextNodeId: "paceTogether",
          branches: [{ when: [{ type: "PROFILE_EQUALS", field: "targetLanguageExperience", value: "new" }], nextNodeId: "paceGentle" }],
          conceptIds: [CONCEPT_IDS.BASIC_QUESTION, CONCEPT_IDS.YES_NO],
          presentation: { expression: "question" },
          response: {
            kind: "choice",
            saveTo: "targetLanguageExperience",
            options: [
              { value: "new", label: "Not yet, I'm starting from zero", icon: "level-1" },
              { value: "some", label: "A few words and phrases", icon: "level-2" },
              { value: "conversational", label: "I can manage a simple conversation", icon: "level-3" }
            ]
          }
        },
        paceGentle: {
          id: "paceGentle",
          speakerId: "sophie",
          targetText: "Pas de problème. On y va doucement.",
          translation: "No problem. We'll take it slowly.",
          nextNodeId: "askMotivation",
          conceptIds: [],
          presentation: { expression: "encouraging" }
        },
        paceTogether: {
          id: "paceTogether",
          speakerId: "sophie",
          targetText: "Super ! On va pratiquer ensemble.",
          translation: "Great! We'll practise together.",
          nextNodeId: "askMotivation",
          conceptIds: [],
          presentation: { expression: "happy" }
        },
        askMotivation: {
          id: "askMotivation",
          speakerId: "sophie",
          targetText: "Et pourquoi tu apprends le français ?",
          translation: "And why are you learning French?",
          nextNodeId: "model",
          conceptIds: [CONCEPT_IDS.BASIC_QUESTION],
          presentation: { expression: "question" },
          response: {
            kind: "choice",
            saveTo: "motivation",
            options: [
              { value: "travel", label: "To travel", icon: "travel" },
              { value: "work", label: "For work", icon: "work" },
              { value: "study", label: "For my studies", icon: "study" },
              { value: "people", label: "For family, friends or a partner", icon: "people" },
              { value: "curiosity", label: "For the pleasure of it", icon: "curiosity" }
            ]
          }
        },
        model: {
          id: "model",
          speakerId: "sophie",
          targetText: "Voilà comment te présenter en français.",
          translation: "Here's how to introduce yourself in French.",
          nextNodeId: "example",
          conceptIds: [],
          presentation: { expression: "explaining" }
        },
        example: {
          id: "example",
          speakerId: "sophie",
          targetText: "Je m'appelle {playerName}. J'apprends le français {motivationPhrase}.",
          translation: "My name is {playerName}. I'm learning French {motivationPhrase}.",
          nextNodeId: "yourTurn",
          conceptIds: [CONCEPT_IDS.INTRODUCE_SELF],
          presentation: { expression: "explaining" }
        },
        yourTurn: {
          id: "yourTurn",
          speakerId: PLAYER_SPEAKER_ID,
          targetText: "Je m'appelle {playerName}.",
          translation: "My name is {playerName}.",
          nextNodeId: "invitation",
          conceptIds: [CONCEPT_IDS.INTRODUCE_SELF],
          presentation: { expression: "question" },
          hint: "Je m'appelle ____.",
          assessment: { excludedSpans: ["playerName"] },
          response: {
            kind: "say",
            exerciseId: "ch1-introduce-self-001",
            intentId: "introduceSelf",
            prompt: "Your turn. Introduce yourself.",
            options: [
              { id: "introduce", text: "Je m'appelle {playerName}.", translation: "My name is {playerName}." },
              { id: "goodbye", text: "Merci, au revoir !", translation: "Thank you, goodbye!" }
            ],
            repairNodeId: "repairIntroduction"
          }
        },
        repairIntroduction: {
          id: "repairIntroduction",
          speakerId: "sophie",
          targetText: "Pardon ? Comment tu t'appelles ?",
          translation: "Sorry? What's your name?",
          conceptIds: [CONCEPT_IDS.INTRODUCE_SELF, CONCEPT_IDS.BASIC_QUESTION],
          presentation: { expression: "confused" }
        },
        invitation: {
          id: "invitation",
          speakerId: "sophie",
          targetText: "Allez, viens ! Je vais te montrer le quartier.",
          translation: "Come on! I'll show you the neighborhood.",
          conceptIds: [],
          presentation: { expression: "encouraging" }
        }
      }
    },
    sophieCatchUp: {
      id: "sophieCatchUp",
      startNodeId: "hello",
      nodes: {
        hello: {
          id: "hello",
          speakerId: "sophie",
          targetText: "Salut, {playerName} ! Ça va ?",
          translation: "Hi, {playerName}! How's it going?",
          conceptIds: [CONCEPT_IDS.GREETING, CONCEPT_IDS.BASIC_QUESTION],
          presentation: { expression: "neutral" }
        }
      }
    },
    sophieToCafe: {
      id: "sophieToCafe",
      startNodeId: "nudge",
      nodes: {
        nudge: {
          id: "nudge",
          speakerId: "sophie",
          targetText: "Le café est juste là. Vas-y, commande un café !",
          translation: "The café is right there. Go on, order a coffee!",
          conceptIds: [],
          presentation: { expression: "encouraging" }
        }
      }
    },
    sophieToBakery: {
      id: "sophieToBakery",
      startNodeId: "nudge",
      nodes: {
        nudge: {
          id: "nudge",
          speakerId: "sophie",
          targetText: "Bravo pour le café ! Maintenant, la boulangerie.",
          translation: "Well done with the coffee! Now, the bakery.",
          conceptIds: [],
          presentation: { expression: "explaining" }
        }
      }
    },
    sophieToSquare: {
      id: "sophieToSquare",
      startNodeId: "malik",
      nodes: {
        malik: {
          id: "malik",
          speakerId: "sophie",
          targetText: "Tu connais Malik ? Il est sur la place.",
          translation: "Do you know Malik? He's in the square.",
          nextNodeId: "go",
          conceptIds: [CONCEPT_IDS.BASIC_QUESTION, CONCEPT_IDS.YES_NO],
          presentation: { expression: "question" }
        },
        go: {
          id: "go",
          speakerId: "sophie",
          targetText: "Va lui dire bonjour !",
          translation: "Go and say hello to him!",
          conceptIds: [CONCEPT_IDS.GREETING],
          presentation: { expression: "encouraging" }
        }
      }
    },
    sophieAfterErrands: {
      id: "sophieAfterErrands",
      startNodeId: "howAreYou",
      nodes: {
        howAreYou: {
          id: "howAreYou",
          speakerId: "sophie",
          targetText: "Alors, {playerName}, ça va ?",
          translation: "So, {playerName}, how's it going?",
          nextNodeId: "wellDone",
          conceptIds: [CONCEPT_IDS.BASIC_QUESTION],
          presentation: { expression: "question" }
        },
        wellDone: {
          id: "wellDone",
          speakerId: "sophie",
          targetText: "Un café, un croissant, un nouvel ami… Bravo !",
          translation: "A coffee, a croissant, a new friend… Well done!",
          nextNodeId: "later",
          conceptIds: [],
          presentation: { expression: "happy" }
        },
        later: {
          id: "later",
          speakerId: "sophie",
          targetText: "Je t'écris plus tard. À bientôt !",
          translation: "I'll write to you later. See you soon!",
          conceptIds: [CONCEPT_IDS.FAREWELL],
          presentation: { expression: "neutral" }
        }
      }
    },
    sophieGoodbye: {
      id: "sophieGoodbye",
      startNodeId: "bye",
      nodes: {
        bye: {
          id: "bye",
          speakerId: "sophie",
          targetText: "À bientôt, {playerName} ! Rentre bien.",
          translation: "See you soon, {playerName}! Get home safe.",
          conceptIds: [CONCEPT_IDS.FAREWELL],
          presentation: { expression: "neutral" }
        }
      }
    },
    // Sent to the player's phone in the last quest. Written, so the answers are typed.
    sophieMessage: {
      id: "sophieMessage",
      startNodeId: "hi",
      nodes: {
        hi: {
          id: "hi",
          speakerId: "sophie",
          targetText: "Salut {playerName} ! Ça va ?",
          translation: "Hi {playerName}! How's it going?",
          nextNodeId: "fine",
          conceptIds: [CONCEPT_IDS.GREETING, CONCEPT_IDS.BASIC_QUESTION]
        },
        fine: {
          id: "fine",
          speakerId: PLAYER_SPEAKER_ID,
          targetText: "Ça va bien, merci !",
          translation: "I'm fine, thanks!",
          nextNodeId: "invite",
          conceptIds: [CONCEPT_IDS.BASIC_QUESTION],
          hint: "Ça va ____.",
          response: {
            kind: "say",
            exerciseId: "ch1-message-fine-001",
            intentId: "sayHowYouAre",
            prompt: "Tell Sophie how you are.",
            options: [
              { id: "fine", text: "Ça va bien, merci !", translation: "I'm fine, thanks!" },
              { id: "coffee", text: "Un café, s'il vous plaît.", translation: "A coffee, please." }
            ],
            repairNodeId: "repairFine"
          }
        },
        repairFine: {
          id: "repairFine",
          speakerId: "sophie",
          targetText: "Pardon ? Ça va bien ?",
          translation: "Sorry? Are you doing well?",
          conceptIds: [CONCEPT_IDS.BASIC_QUESTION]
        },
        invite: {
          id: "invite",
          speakerId: "sophie",
          targetText: "Super ! Tu veux aller au café demain ?",
          translation: "Great! Do you want to go to the café tomorrow?",
          nextNodeId: "answer",
          conceptIds: [CONCEPT_IDS.BASIC_QUESTION, CONCEPT_IDS.YES_NO]
        },
        answer: {
          id: "answer",
          speakerId: PLAYER_SPEAKER_ID,
          targetText: "Oui, avec plaisir !",
          translation: "Yes, gladly!",
          nextNodeId: "bye",
          conceptIds: [CONCEPT_IDS.YES_NO],
          hint: "Oui, ____ / Non, ____",
          response: {
            kind: "say",
            exerciseId: "ch1-message-answer-001",
            intentId: "answerYesNo",
            prompt: "Answer Sophie: yes or no?",
            options: [
              { id: "yes", text: "Oui, avec plaisir !", translation: "Yes, gladly!" },
              { id: "no", text: "Non, merci.", translation: "No, thank you." },
              { id: "hello", text: "Bonjour !", translation: "Hello!" }
            ],
            repairNodeId: "repairAnswer"
          }
        },
        repairAnswer: {
          id: "repairAnswer",
          speakerId: "sophie",
          targetText: "Pardon ? Oui ou non ?",
          translation: "Sorry? Yes or no?",
          conceptIds: [CONCEPT_IDS.YES_NO]
        },
        bye: {
          id: "bye",
          speakerId: "sophie",
          targetText: "D'accord ! À bientôt, {playerName} !",
          translation: "OK! See you soon, {playerName}!",
          conceptIds: [CONCEPT_IDS.FAREWELL]
        }
      }
    },
    meetBarista: {
      id: "meetBarista",
      startNodeId: "welcome",
      nodes: {
        welcome: {
          id: "welcome",
          speakerId: "barista",
          targetText: "Bonjour ! Bienvenue au café.",
          translation: "Hello! Welcome to the café.",
          conceptIds: [CONCEPT_IDS.GREETING],
        }
      }
    },
    cafeOrder: {
      id: "cafeOrder",
      startNodeId: "welcome",
      nodes: {
        welcome: {
          id: "welcome",
          speakerId: "barista",
          targetText: "Bonjour !",
          translation: "Hello!",
          nextNodeId: "greet",
          conceptIds: [CONCEPT_IDS.GREETING],
        },
        greet: {
          id: "greet",
          speakerId: PLAYER_SPEAKER_ID,
          targetText: "Bonjour !",
          translation: "Hello!",
          nextNodeId: "ask",
          conceptIds: [CONCEPT_IDS.GREETING],
          response: {
            kind: "say",
            exerciseId: "ch1-cafe-greet-001",
            intentId: "greet",
            prompt: "Your turn. Say hello.",
            options: [
              { id: "hello", text: "Bonjour !", translation: "Hello!" },
              { id: "goodbye", text: "Au revoir !", translation: "Goodbye!" }
            ],
            repairNodeId: "pardon"
          }
        },
        ask: {
          id: "ask",
          speakerId: "barista",
          targetText: "Vous désirez ?",
          translation: "What would you like?",
          presentation: { expression: "question" },
          nextNodeId: "order",
          conceptIds: [CONCEPT_IDS.ORDER_ITEM, CONCEPT_IDS.BASIC_QUESTION]
        },
        order: {
          id: "order",
          speakerId: PLAYER_SPEAKER_ID,
          targetText: "Je voudrais un café, s'il vous plaît.",
          translation: "I would like a coffee, please.",
          nextNodeId: "price",
          conceptIds: [CONCEPT_IDS.ORDER_ITEM, CONCEPT_IDS.POLITE_REQUEST],
          hint: "Un ____, s'il vous plaît.",
          response: {
            kind: "say",
            exerciseId: "ch1-cafe-order-001",
            intentId: "orderDrink",
            prompt: "Your turn. Order a coffee.",
            options: [
              { id: "polite", text: "Je voudrais un café, s'il vous plaît.", translation: "I would like a coffee, please." },
              { id: "short", text: "Un café, s'il vous plaît.", translation: "A coffee, please." },
              { id: "thanks", text: "Merci, au revoir !", translation: "Thank you, goodbye!" }
            ],
            repairNodeId: "repairOrder"
          }
        },
        price: {
          id: "price",
          speakerId: "barista",
          targetText: "Voilà ! Ça fait trois euros.",
          translation: "Here you go! That's three euros.",
          presentation: { expression: "explaining" },
          nextNodeId: "thanks",
          conceptIds: [CONCEPT_IDS.UNDERSTAND_PRICE, CONCEPT_IDS.NUMBERS_1_10],
          response: {
            kind: "act",
            conceptId: CONCEPT_IDS.UNDERSTAND_PRICE,
            prompt: "Pay Nadia.",
            options: [
              { id: "two", label: "2 €", correct: false },
              { id: "three", label: "3 €", correct: true },
              { id: "thirteen", label: "13 €", correct: false }
            ],
            repairNodeId: "repairPrice"
          },
          effects: [{ type: "GIVE_ITEM", itemId: "coffee" }]
        },
        thanks: {
          id: "thanks",
          speakerId: PLAYER_SPEAKER_ID,
          targetText: "Merci !",
          translation: "Thank you!",
          nextNodeId: "bye",
          conceptIds: [CONCEPT_IDS.THANK_PERSON],
          response: {
            kind: "say",
            exerciseId: "ch1-cafe-thanks-001",
            intentId: "thankPerson",
            prompt: "Your turn. Say thank you.",
            options: [
              { id: "thanks", text: "Merci !", translation: "Thank you!" },
              { id: "hello", text: "Bonjour !", translation: "Hello!" }
            ],
            repairNodeId: "pardon"
          }
        },
        bye: {
          id: "bye",
          speakerId: "barista",
          targetText: "Merci, bonne journée !",
          translation: "Thank you, have a nice day!",
          presentation: { expression: "happy" },
          conceptIds: [CONCEPT_IDS.THANK_PERSON, CONCEPT_IDS.FAREWELL],
        },
        pardon: {
          id: "pardon",
          speakerId: "barista",
          targetText: "Pardon ?",
          translation: "Sorry?",
          presentation: { expression: "confused" },
          conceptIds: []
        },
        repairOrder: {
          id: "repairOrder",
          speakerId: "barista",
          targetText: "Pardon ? Un café ? Un thé ?",
          translation: "Sorry? A coffee? A tea?",
          presentation: { expression: "confused" },
          conceptIds: [CONCEPT_IDS.ORDER_ITEM, CONCEPT_IDS.BASIC_QUESTION],
        },
        repairPrice: {
          id: "repairPrice",
          speakerId: "barista",
          targetText: "Non, non. Trois euros, s'il vous plaît.",
          translation: "No, no. Three euros, please.",
          presentation: { expression: "explaining" },
          conceptIds: [CONCEPT_IDS.UNDERSTAND_PRICE, CONCEPT_IDS.POLITE_REQUEST, CONCEPT_IDS.NUMBERS_1_10, CONCEPT_IDS.YES_NO],
        }
      }
    },
    meetBaker: {
      id: "meetBaker",
      startNodeId: "welcome",
      nodes: {
        welcome: {
          id: "welcome",
          speakerId: "baker",
          targetText: "Bonjour ! Entrez, s'il vous plaît.",
          translation: "Hello! Come in, please.",
          conceptIds: [CONCEPT_IDS.GREETING, CONCEPT_IDS.POLITE_REQUEST],
        }
      }
    },
    bakeryOrder: {
      id: "bakeryOrder",
      startNodeId: "welcome",
      nodes: {
        welcome: {
          id: "welcome",
          speakerId: "baker",
          targetText: "Bonjour ! Vous désirez ?",
          translation: "Hello! What would you like?",
          presentation: { expression: "question" },
          nextNodeId: "order",
          conceptIds: [CONCEPT_IDS.GREETING, CONCEPT_IDS.ORDER_ITEM, CONCEPT_IDS.BASIC_QUESTION],
        },
        order: {
          id: "order",
          speakerId: PLAYER_SPEAKER_ID,
          targetText: "Bonjour ! Un croissant, s'il vous plaît.",
          translation: "Hello! A croissant, please.",
          nextNodeId: "price",
          conceptIds: [CONCEPT_IDS.GREETING, CONCEPT_IDS.ORDER_ITEM, CONCEPT_IDS.POLITE_REQUEST],
          hint: "Un ____, s'il vous plaît.",
          response: {
            kind: "say",
            exerciseId: "ch1-bakery-order-001",
            intentId: "orderPastry",
            prompt: "Your turn. Ask for a croissant.",
            options: [
              { id: "croissant", text: "Bonjour ! Un croissant, s'il vous plaît.", translation: "Hello! A croissant, please." },
              { id: "coffee", text: "Un café, s'il vous plaît.", translation: "A coffee, please." }
            ],
            repairNodeId: "repairOrder"
          }
        },
        price: {
          id: "price",
          speakerId: "baker",
          targetText: "Et voilà. Un euro, s'il vous plaît.",
          translation: "Here you are. One euro, please.",
          presentation: { expression: "explaining" },
          nextNodeId: "thanks",
          conceptIds: [CONCEPT_IDS.UNDERSTAND_PRICE, CONCEPT_IDS.POLITE_REQUEST, CONCEPT_IDS.NUMBERS_1_10],
          response: {
            kind: "act",
            conceptId: CONCEPT_IDS.UNDERSTAND_PRICE,
            prompt: "Pay Luc.",
            options: [
              { id: "one", label: "1 €", correct: true },
              { id: "two", label: "2 €", correct: false },
              { id: "eleven", label: "11 €", correct: false }
            ],
            repairNodeId: "repairPrice"
          },
          effects: [{ type: "GIVE_ITEM", itemId: "croissant" }]
        },
        thanks: {
          id: "thanks",
          speakerId: PLAYER_SPEAKER_ID,
          targetText: "Merci, au revoir !",
          translation: "Thank you, goodbye!",
          nextNodeId: "bye",
          conceptIds: [CONCEPT_IDS.THANK_PERSON, CONCEPT_IDS.FAREWELL],
          response: {
            kind: "say",
            exerciseId: "ch1-bakery-thanks-001",
            intentId: "thankPerson",
            prompt: "Your turn. Say thank you and goodbye.",
            options: [
              { id: "thanks", text: "Merci, au revoir !", translation: "Thank you, goodbye!" },
              { id: "hello", text: "Bonjour !", translation: "Hello!" }
            ],
            repairNodeId: "pardon"
          }
        },
        bye: {
          id: "bye",
          speakerId: "baker",
          targetText: "Au revoir, bonne journée !",
          translation: "Goodbye, have a nice day!",
          presentation: { expression: "happy" },
          conceptIds: [CONCEPT_IDS.FAREWELL]
        },
        pardon: {
          id: "pardon",
          speakerId: "baker",
          targetText: "Pardon ?",
          translation: "Sorry?",
          presentation: { expression: "confused" },
          conceptIds: []
        },
        repairOrder: {
          id: "repairOrder",
          speakerId: "baker",
          targetText: "Pardon ? Un croissant ? Une baguette ?",
          translation: "Sorry? A croissant? A baguette?",
          presentation: { expression: "confused" },
          conceptIds: [CONCEPT_IDS.ORDER_ITEM, CONCEPT_IDS.BASIC_QUESTION]
        },
        repairPrice: {
          id: "repairPrice",
          speakerId: "baker",
          targetText: "Non. Un euro, s'il vous plaît.",
          translation: "No. One euro, please.",
          presentation: { expression: "explaining" },
          conceptIds: [CONCEPT_IDS.UNDERSTAND_PRICE, CONCEPT_IDS.POLITE_REQUEST, CONCEPT_IDS.NUMBERS_1_10, CONCEPT_IDS.YES_NO],
        }
      }
    },
    meetNeighbor: {
      id: "meetNeighbor",
      startNodeId: "hello",
      nodes: {
        hello: {
          id: "hello",
          speakerId: "neighbor",
          targetText: "Salut ! Moi, c'est Malik.",
          translation: "Hi! I'm Malik.",
          nextNodeId: "welcome",
          conceptIds: [CONCEPT_IDS.GREETING, CONCEPT_IDS.INTRODUCE_SELF],
        },
        welcome: {
          id: "welcome",
          speakerId: "neighbor",
          targetText: "Bienvenue dans le quartier !",
          translation: "Welcome to the neighborhood!",
          presentation: { expression: "happy" },
          conceptIds: []
        }
      }
    },
    neighborChat: {
      id: "neighborChat",
      startNodeId: "hello",
      nodes: {
        hello: {
          id: "hello",
          speakerId: "neighbor",
          targetText: "Salut ! Ça va ?",
          translation: "Hi! How's it going?",
          presentation: { expression: "question" },
          conceptIds: [CONCEPT_IDS.GREETING, CONCEPT_IDS.BASIC_QUESTION],
        }
      }
    }
  }
};
