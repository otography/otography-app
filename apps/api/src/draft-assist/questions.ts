export const DRAFT_ASSIST_QUESTIONS = {
  tone_type: {
    type: "choice",
    instructions: "Classify the primary nature of the user's draft text about a song.",
    criteria: {
      abstract_only:
        "Consists only of vague emotional exclamations (e.g., 'amazing', 'emotional', 'made me cry') with no concrete scene, timing, musical detail, or memory.",
      objective_critique:
        "Focuses on objective evaluation, technical praise, genre comparison, or rating the song as a work rather than personal experience.",
      personal_experience:
        "Describes a concrete personal memory, listening situation, specific musical detail, or personal emotional/behavioral shift.",
      other:
        "Incomplete fragment, unintelligible text, or cannot be clearly categorized into the above.",
    },
  },
  has_space: {
    type: "noul",
    instructions: "Does the draft mention a physical place, scenery, weather, or environment?",
    criteria: {
      true: "Describes a specific location, weather, or visual scene.",
      false: "No mention of physical setting or environment.",
    },
  },
  has_time: {
    type: "noul",
    instructions: "Does the draft mention a time of day, season, or life timing?",
    criteria: {
      true: "Describes a temporal context (e.g., midnight, commute, after work, summer).",
      false: "No temporal context is mentioned.",
    },
  },
  has_sound: {
    type: "noul",
    instructions: "Does the draft reference a specific musical element of the song?",
    criteria: {
      true: "Mentions lyrics, intro, melody, rhythm, instrument, voice, or a specific part of the song.",
      false: "Does not reference any specific musical element.",
    },
  },
  has_memory: {
    type: "noul",
    instructions:
      "Does the draft mention a past memory, past event, or nostalgia triggered by the song?",
    criteria: {
      true: "References a personal past experience, specific period in life, or recalled memory.",
      false: "Does not mention any past memory or recalled event.",
    },
  },
  has_emotion_or_action: {
    type: "noul",
    instructions:
      "Does the draft describe an internal emotional shift, bodily sensation, or physical action?",
    criteria: {
      true: "Explains how the listener felt, changed internally, or acted while/after listening.",
      false: "No internal emotional shift, sensation, or action is described.",
    },
  },
} as const;
