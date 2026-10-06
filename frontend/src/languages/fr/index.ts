import { PLAYER_SPEAKER_ID } from "../../dialogue/models";
import { CONCEPT_IDS } from "../../learning/models";
import type { LanguagePack } from "../types";
import { englishNumber, frenchNumber } from "./numbers";

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
    [CONCEPT_IDS.INTRODUCE_SELF]: ["Je m'appelle…", "Moi, c'est…", "J'ai … ans."],
    [CONCEPT_IDS.BASIC_QUESTION]: ["Comment tu t'appelles ?", "Tu as quel âge ?", "Ça va ?", "Vous désirez ?"],
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
      introducedIn: { chapter: 1, dialogueId: "sophieCatchUp" }
    },
    {
      id: "fr.sappeler", lemma: "s'appeler", surfaceForms: ["je m'appelle", "tu t'appelles"], gloss: "to be called", partOfSpeech: "verb",
      conceptIds: [CONCEPT_IDS.INTRODUCE_SELF],
      examples: [{ target: "Je m'appelle Sophie.", translation: "My name is Sophie." }],
      introducedIn: { chapter: 1, dialogueId: "meetSophie" }
    },
    {
      id: "fr.pardon", lemma: "pardon", surfaceForms: ["pardon"], gloss: "sorry? / excuse me", partOfSpeech: "interjection",
      conceptIds: [CONCEPT_IDS.BASIC_QUESTION],
      examples: [{ target: "Pardon ?", translation: "Sorry?" }],
      introducedIn: { chapter: 1, dialogueId: "sophieMessage" }
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
      introducedIn: { chapter: 1, dialogueId: "walkToCafe" }
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
      introducedIn: { chapter: 1, dialogueId: "walkToCafe" }
    },
    {
      id: "fr.bien", lemma: "bien", surfaceForms: ["bien"], gloss: "well; good", partOfSpeech: "interjection",
      conceptIds: [CONCEPT_IDS.BASIC_QUESTION],
      examples: [{ target: "Ça va bien.", translation: "I'm good." }],
      introducedIn: { chapter: 1, dialogueId: "walkToCafe" }
    },
    {
      id: "fr.quelage", lemma: "quel âge", surfaceForms: ["quel âge"], gloss: "how old", partOfSpeech: "phrase",
      conceptIds: [CONCEPT_IDS.BASIC_QUESTION],
      examples: [{ target: "Tu as quel âge ?", translation: "How old are you?" }],
      introducedIn: { chapter: 1, dialogueId: "walkToCafe" }
    },
    {
      id: "fr.ans", lemma: "an", surfaceForms: ["ans"], gloss: "years (of age)", partOfSpeech: "noun",
      conceptIds: [CONCEPT_IDS.INTRODUCE_SELF],
      examples: [{ target: "J'ai vingt ans.", translation: "I'm twenty years old." }],
      introducedIn: { chapter: 1, dialogueId: "walkToCafe" }
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
    tellAge: {
      id: "tellAge",
      conceptId: CONCEPT_IDS.INTRODUCE_SELF,
      modality: "speaking",
      prompt: "Dis ton âge.",
      meaning: "Say how old they are, in a sentence such as « J'ai … ans ». Any age counts; the number is not checked.",
      acceptedExpressions: ["J'ai vingt ans.", "J'ai 30 ans."],
      match: [["ans"], ["j'ai"]]
    },
    answerCaVa: {
      id: "answerCaVa",
      conceptId: CONCEPT_IDS.BASIC_QUESTION,
      modality: "speaking",
      prompt: "Réponds à « Ça va ? ».",
      meaning: "Answer the question \"how are you?\" (fine, well, not great, and so on).",
      acceptedExpressions: ["Ça va bien.", "Ça va.", "Très bien !"],
      match: [["ça va"], ["bien"], ["pas mal"], ["super"]]
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
    // Written out in words, as in the Ren'Py prototype: "J'ai vingt-neuf ans."
    playerAge: {
      source: "profile-number",
      field: "age",
      spell: (age) => ({ target: frenchNumber(age), translation: englishNumber(age) }),
      fallback: { target: "…", translation: "…" }
    },
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
    },
    // Sophie's model introduction, as in the Ren'Py prototype.
    motivationSentence: {
      source: "profile-lookup",
      field: "motivation",
      fallbackOption: "curiosity",
      options: {
        study: { target: "Je voudrais apprendre à parler français pour mes études.", translation: "I would like to learn French for my studies." },
        work: { target: "Je voudrais apprendre à parler français pour ma carrière.", translation: "I would like to learn French for my career." },
        travel: { target: "Je voudrais apprendre à parler français pour voyager.", translation: "I would like to learn French for travel." },
        people: { target: "Je voudrais apprendre à parler français pour communiquer avec une personne qui compte pour moi.", translation: "I would like to learn French to communicate with someone important to me." },
        curiosity: { target: "Je voudrais apprendre à parler français pour communiquer au quotidien.", translation: "I would like to learn French for everyday communication." }
      }
    },
    levelSentence: {
      source: "profile-lookup",
      field: "targetLanguageExperience",
      fallbackOption: "new",
      options: {
        new: { target: "Mon niveau actuel en français est débutant.", translation: "My current French level is beginner." },
        some: { target: "Mon niveau actuel en français est intermédiaire.", translation: "My current French level is intermediate." },
        conversational: { target: "Mon niveau actuel en français est avancé.", translation: "My current French level is advanced." }
      }
    }
  },
  dialogues: {
    meetSophie: {
      id: "meetSophie",
      startNodeId: "hello",
      autoAdvance: true,
      // Sophie welcomes the player in English, with her recorded voice, as in the
      // Ren'Py prototype; she switches to French to teach the introduction.
      nodes: {
        hello: {
          id: "hello",
          speakerId: "sophie",
          language: "interface",
          targetText: "Hi! I'm Sophie.",
          nextNodeId: "niceToMeetYou",
          conceptIds: [],
          presentation: { expression: "neutral" }
        },
        niceToMeetYou: {
          id: "niceToMeetYou",
          speakerId: "sophie",
          language: "interface",
          targetText: "It's really nice to meet you.",
          nextNodeId: "askName",
          conceptIds: [],
          presentation: { expression: "talking" }
        },
        askName: {
          id: "askName",
          speakerId: "sophie",
          language: "interface",
          targetText: "What's your name?",
          nextNodeId: "greetName",
          conceptIds: [],
          presentation: { expression: "question" },
          response: {
            kind: "text",
            saveTo: "displayName",
            label: "Your name or a nickname",
            note: "A nickname is fine. It stays on this device."
          }
        },
        greetName: {
          id: "greetName",
          speakerId: "sophie",
          language: "interface",
          targetText: "Nice to meet you, {playerName}!",
          nextNodeId: "askAge",
          conceptIds: [],
          presentation: { expression: "excellent" }
        },
        askAge: {
          id: "askAge",
          speakerId: "sophie",
          language: "interface",
          targetText: "And how old are you?",
          nextNodeId: "askExperience",
          conceptIds: [],
          presentation: { expression: "question" },
          response: {
            kind: "text",
            saveTo: "age",
            label: "Your age",
            inputMode: "numeric",
            note: "Just a number, to practise with. It stays on this device."
          }
        },
        askExperience: {
          id: "askExperience",
          speakerId: "sophie",
          language: "interface",
          targetText: "Great! And how much French do you already know?",
          nextNodeId: "askMotivation",
          conceptIds: [],
          presentation: { expression: "question" },
          response: {
            kind: "choice",
            saveTo: "targetLanguageExperience",
            options: [
              { value: "new", label: "Beginner", icon: "level-1" },
              { value: "some", label: "Intermediate", icon: "level-2" },
              { value: "conversational", label: "Expert", icon: "level-3" }
            ]
          }
        },
        askMotivation: {
          id: "askMotivation",
          speakerId: "sophie",
          language: "interface",
          targetText: "And why do you want to learn French?",
          nextNodeId: "great",
          conceptIds: [],
          presentation: { expression: "question" },
          response: {
            kind: "choice",
            saveTo: "motivation",
            options: [
              { value: "study", label: "Education", icon: "study" },
              { value: "work", label: "Career", icon: "work" },
              { value: "travel", label: "Tourism", icon: "travel" },
              { value: "people", label: "Relationship", icon: "people" },
              { value: "curiosity", label: "General purpose", icon: "curiosity" }
            ]
          }
        },
        great: {
          id: "great",
          speakerId: "sophie",
          language: "interface",
          targetText: "Great.",
          nextNodeId: "model",
          conceptIds: [],
          presentation: { expression: "well-done" }
        },
        model: {
          id: "model",
          speakerId: "sophie",
          language: "interface",
          targetText: "With the details you've given me, this is how you could introduce yourself in French.",
          nextNodeId: "example",
          conceptIds: [],
          presentation: { expression: "presenting" }
        },
        example: {
          id: "example",
          speakerId: "sophie",
          targetText: "Je m'appelle {playerName}.\nJ'ai {playerAge} ans.\n{motivationSentence}\n{levelSentence}",
          translation: "My name is {playerName}.\nI am {playerAge} years old.\n{motivationSentence}\n{levelSentence}",
          nextNodeId: "mouthful",
          conceptIds: [CONCEPT_IDS.INTRODUCE_SELF],
          presentation: { expression: "speaking-french" }
        },
        mouthful: {
          id: "mouthful",
          speakerId: "sophie",
          language: "interface",
          targetText: "I know, it's a mouthful!",
          nextNodeId: "bitByBit",
          conceptIds: [],
          presentation: { expression: "playful" }
        },
        bitByBit: {
          id: "bitByBit",
          speakerId: "sophie",
          language: "interface",
          targetText: "So we'll take it bit by bit.",
          nextNodeId: "practice",
          conceptIds: [],
          presentation: { expression: "pinching" }
        },
        practice: {
          id: "practice",
          speakerId: PLAYER_SPEAKER_ID,
          targetText: "Je m'appelle {playerName}.\nJ'ai {playerAge} ans.\n{motivationSentence}\n{levelSentence}",
          translation: "My name is {playerName}.\nI am {playerAge} years old.\n{motivationSentence}\n{levelSentence}",
          nextNodeId: "letsGo",
          conceptIds: [CONCEPT_IDS.INTRODUCE_SELF],
          presentation: { expression: "encouraging" },
          assessment: { excludedSpans: ["playerName"] },
          response: {
            kind: "practice",
            lines: [
              { text: "Je m'appelle {playerName}.", translation: "My name is {playerName}." },
              { text: "J'ai {playerAge} ans.", translation: "I am {playerAge} years old." },
              { text: "{motivationSentence}", translation: "{motivationSentence}" },
              { text: "{levelSentence}", translation: "{levelSentence}" }
            ]
          }
        },
        // Practice done, Sophie turns toward the park gate: on to Scene 2, the walk to the café.
        letsGo: {
          id: "letsGo",
          speakerId: "sophie",
          language: "interface",
          targetText: "Ready? Let's go get something to drink.",
          conceptIds: [],
          presentation: { expression: "inviting", framing: "wide", scene: "park" },
          response: { kind: "continue", label: "Let's go" }
        }
      }
    },
    // Goal 1, Scene 2: the walk from the park to the café. The first retrieval scene:
    // Sophie asks for what Scene 1 taught, in a conversation rather than a quiz.
    // See docs/SCENE-2-WALK-TO-CAFE.md. Everything is framed wide, so the street shows.
    walkToCafe: {
      id: "walkToCafe",
      startNodeId: "walkOut",
      autoAdvance: true,
      // One continuous shot on the street: Sophie stops where she is and looks back to talk.
      staging: "street",
      nodes: {
        // Beat 1: leaving the park. The camera pulls back from Sophie and follows her out.
        walkOut: {
          id: "walkOut",
          speakerId: "sophie",
          language: "interface",
          targetText: "",
          nextNodeId: "learned",
          conceptIds: [],
          presentation: { scene: "park-exit" },
          interlude: { kind: "walk", segments: [{ scene: "park", zoom: [1, 1.3] }, { scene: "park-exit", zoom: [1, 1.3] }], durationMs: 7500 }
        },
        learned: {
          id: "learned",
          speakerId: "sophie",
          language: "interface",
          targetText: "You've already learned quite a bit about introducing yourself.",
          nextNodeId: "remember",
          conceptIds: [],
          presentation: { expression: "explaining", framing: "wide", scene: "park-exit" }
        },
        remember: {
          id: "remember",
          speakerId: "sophie",
          language: "interface",
          targetText: "Let's see what you remember on the way.",
          nextNodeId: "walkIntoTown",
          conceptIds: [],
          presentation: { expression: "glance", framing: "wide" }
        },
        // A few seconds of walking, with no questions yet.
        walkIntoTown: {
          id: "walkIntoTown",
          speakerId: "sophie",
          language: "interface",
          targetText: "",
          nextNodeId: "ifIAsk",
          conceptIds: [],
          presentation: { scene: "lyon-route" },
          interlude: { kind: "walk", segments: [{ scene: "park-exit", zoom: [1.3, 1.7] }, { scene: "lyon-route", zoom: [1, 1.2], people: [{ id: "passerby", at: "far" }, { id: "shopkeeper" }] }], durationMs: 6500 }
        },
        // Beat 2: the first question, the name.
        ifIAsk: {
          id: "ifIAsk",
          speakerId: "sophie",
          language: "interface",
          targetText: "How do you respond to this?",
          nextNodeId: "nameAnswer",
          conceptIds: [],
          presentation: { expression: "question", framing: "wide", scene: "lyon-route" }
        },
        nameAnswer: {
          id: "nameAnswer",
          speakerId: PLAYER_SPEAKER_ID,
          targetText: "Je m'appelle {playerName}.",
          translation: "My name is {playerName}.",
          nextNodeId: "peopleOnStreet",
          conceptIds: [CONCEPT_IDS.INTRODUCE_SELF],
          presentation: { expression: "listening", framing: "wide", translation: "delayed" },
          hint: "Je m'appelle ____.",
          assessment: { excludedSpans: ["playerName"] },
          response: {
            kind: "say",
            exerciseId: "ch1-walk-name-001",
            intentId: "introduceSelf",
            prompt: "Answer out loud.",
            speakOnly: true,
            question: { text: "Comment tu t'appelles ?", translation: "What's your name?" },
            repairNodeId: "tryAgain"
          }
        },
        // Shared by the speaking cards: Sophie encourages, then the same card comes back.
        tryAgain: {
          id: "tryAgain",
          speakerId: "sophie",
          language: "interface",
          targetText: "Almost. Listen once more.",
          conceptIds: [],
          presentation: { expression: "encouraging", framing: "wide" }
        },
        // Someone is coming up the street, and the shopkeeper is outside her shop: seen
        // from here, far off, and closer with every step.
        peopleOnStreet: {
          id: "peopleOnStreet",
          speakerId: "sophie",
          language: "interface",
          targetText: "There are people on the street. Let's interact with them.",
          nextNodeId: "walkToShops",
          conceptIds: [],
          presentation: { expression: "pleased", framing: "wide" }
        },
        walkToShops: {
          id: "walkToShops",
          speakerId: "sophie",
          language: "interface",
          targetText: "",
          nextNodeId: "passerbyHello",
          conceptIds: [],
          presentation: { scene: "lyon-route" },
          interlude: { kind: "walk", segments: [{ scene: "lyon-route", zoom: [1.2, 1.45], people: [{ id: "passerby", at: "far", to: "near" }, { id: "shopkeeper" }] }], durationMs: 4500 }
        },
        // Beat 3: a greeting in passing. Bonjour is not translated: it is known by now.
        passerbyHello: {
          id: "passerbyHello",
          speakerId: "passerby",
          targetText: "Bonjour !",
          nextNodeId: "sophieHello",
          conceptIds: [CONCEPT_IDS.GREETING],
          presentation: { expression: "neutral", framing: "wide", street: { with: "passerby", people: [{ id: "passerby", wave: true }, { id: "shopkeeper" }] } }
        },
        sophieHello: {
          id: "sophieHello",
          speakerId: "sophie",
          targetText: "Bonjour !",
          nextNodeId: "yourTurnNext",
          conceptIds: [CONCEPT_IDS.GREETING],
          presentation: { expression: "greeting", framing: "wide", street: { pose: "greeting", with: "passerby" } }
        },
        yourTurnNext: {
          id: "yourTurnNext",
          speakerId: "sophie",
          language: "interface",
          targetText: "Your turn next time.",
          nextNodeId: "walkToShopkeeper",
          conceptIds: [],
          // The passer-by walks on, past the camera.
          presentation: { expression: "glance", framing: "wide", street: { people: [{ id: "passerby", at: "near", to: "passed" }, { id: "shopkeeper" }] } }
        },
        walkToShopkeeper: {
          id: "walkToShopkeeper",
          speakerId: "sophie",
          language: "interface",
          targetText: "",
          nextNodeId: "greetShopkeeper",
          conceptIds: [],
          presentation: { scene: "lyon-route" },
          interlude: { kind: "walk", segments: [{ scene: "lyon-route", zoom: [1.45, 1.7], people: [{ id: "shopkeeper" }] }], durationMs: 3800 }
        },
        greetShopkeeper: {
          id: "greetShopkeeper",
          speakerId: PLAYER_SPEAKER_ID,
          targetText: "Bonjour !",
          nextNodeId: "parfait",
          conceptIds: [CONCEPT_IDS.GREETING],
          presentation: { expression: "neutral", framing: "wide", focus: "shopkeeper", street: { with: "shopkeeper", people: [{ id: "shopkeeper", wave: true }] } },
          response: {
            kind: "say",
            exerciseId: "ch1-walk-greet-001",
            intentId: "greet",
            prompt: "Answer out loud.",
            speakOnly: true,
            question: { text: "Bonjour !", speakerId: "shopkeeper" },
            repairNodeId: "tryAgain"
          }
        },
        parfait: {
          id: "parfait",
          speakerId: "sophie",
          targetText: "Parfait.",
          translation: "Perfect.",
          nextNodeId: "walkOn",
          conceptIds: [],
          presentation: { expression: "pleased", framing: "wide" }
        },
        // Beat 4: a new question, ça va.
        walkOn: {
          id: "walkOn",
          speakerId: "sophie",
          language: "interface",
          targetText: "",
          nextNodeId: "anotherQuestion",
          conceptIds: [],
          presentation: { scene: "lyon-route" },
          interlude: { kind: "walk", segments: [{ scene: "lyon-route", zoom: [1.7, 1.85], people: [{ id: "shopkeeper", to: "passed", start: 0.3 }] }], durationMs: 4200 }
        },
        anotherQuestion: {
          id: "anotherQuestion",
          speakerId: "sophie",
          language: "interface",
          targetText: "There's another question you'll hear all the time.",
          nextNodeId: "caVaIntro",
          conceptIds: [],
          presentation: { expression: "explaining", framing: "wide" }
        },
        caVaIntro: {
          id: "caVaIntro",
          speakerId: "sophie",
          targetText: "Ça va ?",
          translation: "How are you? / Are you okay?",
          nextNodeId: "notWordForWord",
          conceptIds: [CONCEPT_IDS.BASIC_QUESTION],
          presentation: { expression: "question", framing: "wide", translation: "delayed" }
        },
        notWordForWord: {
          id: "notWordForWord",
          speakerId: "sophie",
          language: "interface",
          targetText: "It's one of those expressions that doesn't translate perfectly word for word.",
          nextNodeId: "casual",
          conceptIds: [],
          presentation: { expression: "explaining", framing: "wide" }
        },
        casual: {
          id: "casual",
          speakerId: "sophie",
          language: "interface",
          targetText: "For now, just remember it as a casual 'How are you?'",
          nextNodeId: "caVaListen",
          conceptIds: [],
          presentation: { expression: "explaining", framing: "wide" }
        },
        // Listen only: nothing to say yet.
        caVaListen: {
          id: "caVaListen",
          speakerId: "sophie",
          targetText: "Ça va ?",
          translation: "How are you?",
          nextNodeId: "easyAnswer",
          conceptIds: [CONCEPT_IDS.BASIC_QUESTION],
          presentation: { expression: "question", framing: "wide" }
        },
        easyAnswer: {
          id: "easyAnswer",
          speakerId: "sophie",
          language: "interface",
          targetText: "And an easy answer is…",
          nextNodeId: "caVaBien",
          conceptIds: [],
          presentation: { expression: "explaining", framing: "wide" }
        },
        caVaBien: {
          id: "caVaBien",
          speakerId: "sophie",
          targetText: "Ça va bien.",
          translation: "I'm good.",
          nextNodeId: "yourTurnCaVa",
          conceptIds: [CONCEPT_IDS.BASIC_QUESTION],
          presentation: { expression: "pleased", framing: "wide", translation: "delayed" }
        },
        yourTurnCaVa: {
          id: "yourTurnCaVa",
          speakerId: "sophie",
          language: "interface",
          targetText: "Your turn.",
          nextNodeId: "caVaAnswer",
          conceptIds: [],
          presentation: { expression: "listening", framing: "wide" }
        },
        caVaAnswer: {
          id: "caVaAnswer",
          speakerId: PLAYER_SPEAKER_ID,
          targetText: "Ça va bien.",
          translation: "I'm good.",
          nextNodeId: "tresBien",
          conceptIds: [CONCEPT_IDS.BASIC_QUESTION],
          presentation: { expression: "listening", framing: "wide" },
          hint: "Ça va ____.",
          response: {
            kind: "say",
            exerciseId: "ch1-walk-cava-001",
            intentId: "answerCaVa",
            prompt: "Answer out loud.",
            speakOnly: true,
            question: { text: "Ça va ?", translation: "How are you?" },
            repairNodeId: "tryAgain"
          }
        },
        // Exposure only: "très bien" is not tested in this scene.
        tresBien: {
          id: "tresBien",
          speakerId: "sophie",
          targetText: "Très bien.",
          translation: "Very good.",
          nextNodeId: "caVaCheckAnswer",
          conceptIds: [],
          presentation: { expression: "pleased", framing: "wide" }
        },
        caVaCheckAnswer: {
          id: "caVaCheckAnswer",
          speakerId: PLAYER_SPEAKER_ID,
          targetText: "Ça va bien.",
          translation: "I'm good.",
          nextNodeId: "bien",
          conceptIds: [CONCEPT_IDS.BASIC_QUESTION],
          presentation: { expression: "glance", framing: "wide", translation: "on-request" },
          hint: "Ça va ____.",
          response: {
            kind: "say",
            exerciseId: "ch1-walk-cava-002",
            intentId: "answerCaVa",
            prompt: "Answer out loud.",
            speakOnly: true,
            question: { text: "Ça va ?", translation: "How are you?" },
            repairNodeId: "tryAgain"
          }
        },
        bien: {
          id: "bien",
          speakerId: "sophie",
          targetText: "Bien.",
          translation: "Good.",
          nextNodeId: "walkNearer",
          conceptIds: [],
          presentation: { expression: "pleased", framing: "wide" }
        },
        walkNearer: {
          id: "walkNearer",
          speakerId: "sophie",
          language: "interface",
          targetText: "",
          nextNodeId: "oneMore",
          conceptIds: [],
          presentation: { scene: "lyon-route" },
          interlude: { kind: "walk", segments: [{ scene: "lyon-route", zoom: [1.85, 2] }], durationMs: 4200 }
        },
        // Beat 6: the second major retrieval, the age.
        oneMore: {
          id: "oneMore",
          speakerId: "sophie",
          language: "interface",
          targetText: "One more before we get there.",
          nextNodeId: "ageAnswer",
          conceptIds: [],
          presentation: { expression: "glance", framing: "wide" }
        },
        ageAnswer: {
          id: "ageAnswer",
          speakerId: PLAYER_SPEAKER_ID,
          targetText: "J'ai {playerAge} ans.",
          translation: "I'm {playerAge} years old.",
          nextNodeId: "ageExactly",
          conceptIds: [CONCEPT_IDS.INTRODUCE_SELF],
          presentation: { expression: "listening", framing: "wide", translation: "delayed" },
          hint: "J'ai ____ ans.",
          assessment: { excludedSpans: ["playerAge"] },
          response: {
            kind: "say",
            exerciseId: "ch1-walk-age-001",
            intentId: "tellAge",
            prompt: "Answer out loud.",
            speakOnly: true,
            question: { text: "Tu as quel âge ?", translation: "How old are you?" },
            repairNodeId: "tryAgain"
          }
        },
        ageExactly: {
          id: "ageExactly",
          speakerId: "sophie",
          language: "interface",
          targetText: "Exactly.",
          nextNodeId: "agePair",
          conceptIds: [],
          presentation: { expression: "pleased", framing: "wide" }
        },
        agePair: {
          id: "agePair",
          speakerId: "sophie",
          targetText: "Tu as quel âge ? — J'ai {playerAge} ans.",
          translation: "How old are you? — I'm {playerAge} years old.",
          nextNodeId: "tinyConversation",
          conceptIds: [CONCEPT_IDS.BASIC_QUESTION, CONCEPT_IDS.INTRODUCE_SELF],
          presentation: { expression: "explaining", framing: "wide" }
        },
        // Beat 7: the questions mixed, French only unless help is asked for.
        tinyConversation: {
          id: "tinyConversation",
          speakerId: "sophie",
          language: "interface",
          targetText: "Okay. Tiny conversation. No English unless you ask for help.",
          nextNodeId: "miniHelloAnswer",
          conceptIds: [],
          presentation: { expression: "explaining", framing: "wide" }
        },
        miniHelloAnswer: {
          id: "miniHelloAnswer",
          speakerId: PLAYER_SPEAKER_ID,
          targetText: "Bonjour !",
          translation: "Hello!",
          nextNodeId: "miniCaVaAnswer",
          conceptIds: [CONCEPT_IDS.GREETING],
          presentation: { expression: "listening", framing: "wide", translation: "on-request" },
          response: {
            kind: "say",
            exerciseId: "ch1-walk-mini-001",
            intentId: "greet",
            prompt: "Answer out loud.",
            speakOnly: true,
            question: { text: "Bonjour !", translation: "Hello!" },
            repairNodeId: "pardon"
          }
        },
        // In the mini-conversation a miss gets a French "Sorry?", as in a real conversation.
        pardon: {
          id: "pardon",
          speakerId: "sophie",
          targetText: "Pardon ?",
          translation: "Sorry?",
          conceptIds: [CONCEPT_IDS.BASIC_QUESTION],
          presentation: { expression: "question", framing: "wide" }
        },
        miniCaVaAnswer: {
          id: "miniCaVaAnswer",
          speakerId: PLAYER_SPEAKER_ID,
          targetText: "Ça va bien.",
          translation: "I'm good.",
          nextNodeId: "miniNameAnswer",
          conceptIds: [CONCEPT_IDS.BASIC_QUESTION],
          presentation: { expression: "listening", framing: "wide", translation: "on-request" },
          hint: "Ça va ____.",
          response: {
            kind: "say",
            exerciseId: "ch1-walk-mini-002",
            intentId: "answerCaVa",
            prompt: "Answer out loud.",
            speakOnly: true,
            question: { text: "Ça va ?", translation: "How are you?" },
            repairNodeId: "pardon"
          }
        },
        miniNameAnswer: {
          id: "miniNameAnswer",
          speakerId: PLAYER_SPEAKER_ID,
          targetText: "Je m'appelle {playerName}.",
          translation: "My name is {playerName}.",
          nextNodeId: "miniAgeAnswer",
          conceptIds: [CONCEPT_IDS.INTRODUCE_SELF],
          presentation: { expression: "listening", framing: "wide", translation: "on-request" },
          hint: "Je m'appelle ____.",
          assessment: { excludedSpans: ["playerName"] },
          response: {
            kind: "say",
            exerciseId: "ch1-walk-mini-003",
            intentId: "introduceSelf",
            prompt: "Answer out loud.",
            speakOnly: true,
            question: { text: "Comment tu t'appelles ?", translation: "What's your name?" },
            repairNodeId: "pardon"
          }
        },
        miniAgeAnswer: {
          id: "miniAgeAnswer",
          speakerId: PLAYER_SPEAKER_ID,
          targetText: "J'ai {playerAge} ans.",
          translation: "I'm {playerAge} years old.",
          nextNodeId: "thatWasAConversation",
          conceptIds: [CONCEPT_IDS.INTRODUCE_SELF],
          presentation: { expression: "listening", framing: "wide", translation: "on-request" },
          hint: "J'ai ____ ans.",
          assessment: { excludedSpans: ["playerAge"] },
          response: {
            kind: "say",
            exerciseId: "ch1-walk-mini-004",
            intentId: "tellAge",
            prompt: "Answer out loud.",
            speakOnly: true,
            question: { text: "Tu as quel âge ?", translation: "How old are you?" },
            repairNodeId: "pardon"
          }
        },
        thatWasAConversation: {
          id: "thatWasAConversation",
          speakerId: "sophie",
          language: "interface",
          targetText: "Look at that. That was a conversation.",
          nextNodeId: "noTranslating",
          conceptIds: [],
          presentation: { expression: "proud", framing: "wide" }
        },
        noTranslating: {
          id: "noTranslating",
          speakerId: "sophie",
          language: "interface",
          targetText: "You didn't need to translate every word first.",
          nextNodeId: "whatWeWant",
          conceptIds: [],
          presentation: { expression: "pleased", framing: "wide" }
        },
        whatWeWant: {
          id: "whatWeWant",
          speakerId: "sophie",
          language: "interface",
          targetText: "That's exactly what we want.",
          nextNodeId: "walkToCafeDoor",
          conceptIds: [],
          presentation: { expression: "pleased", framing: "wide" }
        },
        // The last stretch: the street gives way to the café as the camera comes up to it.
        walkToCafeDoor: {
          id: "walkToCafeDoor",
          speakerId: "sophie",
          language: "interface",
          targetText: "",
          nextNodeId: "weAreHere",
          conceptIds: [],
          presentation: { scene: "cafe-exterior" },
          interlude: { kind: "walk", segments: [{ scene: "lyon-route", zoom: [2, 2.15] }, { scene: "cafe-exterior", zoom: [1, 1.25] }], durationMs: 7000 }
        },
        // Beat 8: the café.
        weAreHere: {
          id: "weAreHere",
          speakerId: "sophie",
          language: "interface",
          targetText: "We're here.",
          nextNodeId: "someoneInside",
          conceptIds: [],
          presentation: { expression: "playful", framing: "wide", scene: "cafe-exterior", street: { pose: "playful" } }
        },
        someoneInside: {
          id: "someoneInside",
          speakerId: "sophie",
          language: "interface",
          targetText: "There's someone inside I want you to meet.",
          nextNodeId: "askYourName",
          conceptIds: [],
          presentation: { expression: "explaining", framing: "wide", street: { pose: "explaining" } }
        },
        askYourName: {
          id: "askYourName",
          speakerId: "sophie",
          language: "interface",
          targetText: "And I have a feeling they're going to ask your name.",
          nextNodeId: "ready",
          conceptIds: [],
          presentation: { expression: "glance", framing: "wide", street: { pose: "pleased" } }
        },
        // "Prêt ? / Prête ?" would need the learner's gender, so Sophie asks in English.
        ready: {
          id: "ready",
          speakerId: "sophie",
          language: "interface",
          targetText: "Ready?",
          conceptIds: [],
          presentation: { expression: "playful", framing: "wide", street: { pose: "playful" } },
          response: { kind: "continue", label: "Let's go in" }
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
          presentation: { expression: "inviting" }
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
          presentation: { expression: "well-done" }
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
          presentation: { expression: "inviting" }
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
          presentation: { expression: "excellent" }
        },
        later: {
          id: "later",
          speakerId: "sophie",
          targetText: "Je t'écris plus tard. À bientôt !",
          translation: "I'll write to you later. See you soon!",
          conceptIds: [CONCEPT_IDS.FAREWELL],
          presentation: { expression: "goodbye" }
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
          presentation: { expression: "goodbye" }
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
