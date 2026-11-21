export const DRAFT_ASSIST_QUESTIONS = {
  tone_type: {
    type: "choice",
    instructions: "Classify the primary nature of the user's draft text about a song.",
    criteria: {
      abstract_only:
        "Consists only of vague emotional exclamations (e.g., 'amazing', 'emotional', 'made me cry', 'love it') with no concrete scene, timing, musical detail, or memory.",
      objective_critique:
        "Focuses on objective evaluation, technical praise, production quality, genre comparison, or rating the song as a work rather than describing a personal experience.",
      personal_experience:
        "Describes a concrete personal memory, listening situation, specific musical detail, or personal emotional/behavioral shift.",
      other:
        "Incomplete fragment, unintelligible text, or cannot be clearly categorized into the above.",
    },
  },
  has_space: {
    type: "noul",
    instructions:
      "Does the draft mention a physical place, scenery, weather, environment, or shared physical setting?",
    criteria: {
      true: "Describes a specific location, weather, visual scene, or a physical setting shared with others (e.g., bedroom, rainy window, walking home, driving with friends, at a live venue).",
      false: "No mention of physical setting, environment, weather, or shared physical situation.",
    },
  },
  has_time: {
    type: "noul",
    instructions: "Does the draft mention a time of day, season, or specific life/daily timing?",
    criteria: {
      true: "Describes a temporal context (e.g., midnight, morning commute, after work, after the last train, summer).",
      false: "No temporal context or timing is mentioned.",
    },
  },
  has_sound: {
    type: "noul",
    instructions: "Does the draft reference a specific musical element of the song?",
    criteria: {
      true: "Mentions lyrics, intro, chorus, melody, rhythm, instrument, voice, arrangement, or a specific moment in the song.",
      false: "Does not reference any specific musical element or part of the song.",
    },
  },
  has_memory: {
    type: "noul",
    instructions:
      "Does the draft mention a past memory, past event, nostalgia, or a specific person recalled by the song?",
    criteria: {
      true: "References a personal past experience, specific period in life, recalled memory, or a specific person recalled (e.g., student days, an old friend, family, past self).",
      false: "Does not mention any past memory, recalled event, or recalled person.",
    },
  },
  has_emotion_or_action: {
    type: "noul",
    instructions:
      "Does the draft describe an internal emotional shift, bodily sensation, or physical action?",
    criteria: {
      true: "Explains how the listener felt, changed internally, sensed physically, or acted while or after listening (e.g., calmed down, felt lighter, slowed my pace, wanted to replay it).",
      false: "No internal emotional shift, bodily sensation, or physical action is described.",
    },
  },
  has_concrete_detail: {
    type: "noul",
    instructions:
      "Does the draft contain at least one concrete, vivid detail (such as a specific musical part, a distinct scene, or a personal memory) rather than only generic or interchangeable words?",
    criteria: {
      true: "Includes specific phrasing that evokes a distinct scene, sound, or personal moment not interchangeable with any song (e.g., 'rain on the train window', 'the distorted guitar in the intro', 'walking home after the last train').",
      false:
        "Consists only of broad, generic, or vague expressions that could apply to almost any song (e.g., 'good', 'relaxing', 'at night', 'nice melody', 'sad').",
    },
  },
} as const;
