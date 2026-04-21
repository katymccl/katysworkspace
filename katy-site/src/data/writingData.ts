export interface WritingFeatured {
  title: string;
  subtitle: string;
  description: string;
  tag: string;
}

export interface WritingItem {
  title: string;
  summary: string;
  tag: string;
}

export interface WritingSection {
  id: string;
  label: string;
  description: string;
  items: WritingItem[];
}

export const writingFeatured: WritingFeatured = {
  title: "A Winter in Quiet Motion",
  subtitle: "Featured essay",
  description:
    "A lyrical exploration of nature, memory, and the small details that shape a season. This piece bridges personal narrative with vivid scene-setting and reflective observation.",
  tag: "Essay",
};

export const writingSections: WritingSection[] = [
  {
    id: "longform",
    label: "Long-form essays",
    description: "Deep dives into emotion, place, and curiosity; essays that linger and invite you to sit with a moment.",
    items: [
      {
        title: "On Winter Light",
        summary: "A reflective piece about how light changes the landscape of memory in cold months.",
        tag: "Personal Essay",
      },
      {
        title: "The Quiet of the Mountain Road",
        summary: "A narrative that follows the rhythm of travel, doubt, and the decision to keep moving.",
        tag: "Travel Essay",
      },
      {
        title: "Architecture of a Pause",
        summary: "An exploration of stillness, creativity, and the spaces we build to think better.",
        tag: "Creative Nonfiction",
      },
    ],
  },
  {
    id: "editorial",
    label: "Editorial narratives",
    description: "Shorter work with clear argument and distinctive voice, written for readers who want to feel provoked and inspired.",
    items: [
      {
        title: "The Case for Quiet Mornings",
        summary: "Why slowing down at the start of the day amplifies productivity and creative energy.",
        tag: "Opinion",
      },
      {
        title: "Storytelling in Design",
        summary: "A look at how narrative anchors product work and makes abstract ideas more human.",
        tag: "Editorial",
      },
      {
        title: "The Body of an Image",
        summary: "A short piece on visual thinking, metaphor, and the craft of describing what you see.",
        tag: "Culture",
      },
    ],
  },
  {
    id: "copy",
    label: "Copy & concept",
    description: "Voice-driven writing for brand, campaign, and conceptual storytelling with a strong editorial bent.",
    items: [
      {
        title: "Headline systems for curiosity",
        summary: "Concept work that balances boldness and clarity for editorial campaigns.",
        tag: "Copy",
      },
      {
        title: "Microcopy that guides",
        summary: "Short, purposeful language designed to move people through experience.",
        tag: "UX Writing",
      },
      {
        title: "Narrative frameworks",
        summary: "Ideas for structuring creative work so it feels coherent, memorable, and human.",
        tag: "Concept",
      },
    ],
  },
  {
    id: "haiku",
    label: "Haikus",
    description: "Moments distilled into seventeen syllables—images and emotions in miniature.",
    items: [
      {
        title: "In the woods, feeling.",
        summary: `In the woods, feeling.
Out.
I can breathe here at last.`,
        tag: "Haiku",
      },
      {
        title: "What point do we stop?",
        summary: `What point do we stop?
Willing dreams that will not be.
If ever(your) hope runs dry.`,
        tag: "Haiku",
      },
      {
        title: "You knew it would end.",
        summary: `You knew it would end.
But I relished each moment.
Calm before the storm.`,
        tag: "Haiku",
      },
      {
        title: "I cooked and you cleaned. (1)",
        summary: `I cooked and you cleaned.
To a classic rock lullaby.
My favorite routine.`,
        tag: "Haiku",
      },
      {
        title: "I cooked and you cleaned. (2)",
        summary: `I cooked and you cleaned.
A classic rock lullaby.
My favorite routine.`,
        tag: "Haiku",
      },
      {
        title: "I cooked and you cleaned. (3)",
        summary: `I cooked and you cleaned.
A classic rock lullaby.
My favorite routine.`,
        tag: "Haiku",
      },
      {
        title: "A single drip falls.",
        summary: `A single drip falls.
Rippled impact crumbles the pack.
Butterfly effect.`,
        tag: "Haiku",
      },
      {
        title: "Filing your taxes sucks.",
        summary: `Filing your taxes sucks.
As if they didn’t take enough.
Uncle Sam’s biggest scam.`,
        tag: "Haiku",
      },
      {
        title: "Haikus just won't do.",
        summary: `Haikus just won't do.
To quite show my love for you.
My friend and my mom.`,
        tag: "Haiku",
      },
      {
        title: "Imagine a land",
        summary: `Imagine a land
Where jumps, flow and steez abound
[See you at peace park.]`,
        tag: "Haiku",
      },
      {
        title: "Tiny black white squares.",
        summary: `Tiny black white squares.
Nine letters: a fun game.
Can you guess my clue?`,
        tag: "Haiku",
      },
      {
        title: "You can rest your eyes.",
        summary: `You can rest your eyes.
Until the sun will rise.
Goodnight, I love you.`,
        tag: "Haiku",
      },
      {
        title: "But why should I write?",
        summary: `But why should I write?
If you do not answer them
forever alone.`,
        tag: "Haiku",
      },
      {
        title: "What will I ever do?",
        summary: `What will I ever do?
It's going to rain this weekend.
Peace park calls my name.`,
        tag: "Haiku",
      },
      {
        title: "when winter is deep",
        summary: `when winter is deep
finally find peaceful sleep
kept safe soft embrace.`,
        tag: "Haiku",
      },
      {
        title: "When deep winter falls",
        summary: `When deep winter falls
I finally find true peace
Wrapped up , soft embrace`,
        tag: "Haiku",
      },
      {
        title: "Slosh turn stop and wait",
        summary: `Slosh turn stop and wait
Moguls are a thing I hate
Legs burn and feet ache`,
        tag: "Haiku",
      },
      {
        title: "I can't tell you all",
        summary: `I can't tell you all
That's too much for you to bare
Secrets in my hearts lair`,
        tag: "Haiku",
      },
      {
        title: "I love you, forever.",
        summary: `I love you, forever.
But you'll never reciprocate
Maybe that's enough.`,
        tag: "Haiku",
      },
      {
        title: "Fragments of normal",
        summary: `Fragments of normal
Salt, pictures, clean sheets, warm meals
Pieces of make believe.`,
        tag: "Haiku",
      },
      {
        title: "Visiting your grandparents",
        summary: `Visiting your grandparents
Makes you learn about yourself
Looking in a mirror.`,
        tag: "Haiku",
      },
      {
        title: "Tip toe across now",
        summary: `Tip toe across now
One step too far , you will fall
The tightrope of life.`,
        tag: "Haiku",
      },
      {
        title: "Careful steps across",
        summary: `Careful steps across
Rope woven far too narrow.
Balance soon falters`,
        tag: "Haiku",
      },
      {
        title: "What exists below?",
        summary: `What exists below?
A tightrope woven [far too] narrow.
I fear what lies below`,
        tag: "Haiku",
      },
      {
        title: "Ever connected.",
        summary: `Ever connected.
So how did I get so lost ?
My tether -- broken`,
        tag: "Haiku",
      },
      {
        title: "it's beautifully dark.",
        summary: `it's beautifully dark.
For once just planes light the sky.
Constant, ever going.`,
        tag: "Haiku",
      },
      {
        title: "She waited for planes",
        summary: `She waited for planes
While she waited for you.
Blinking lights of the sky.`,
        tag: "Haiku",
      },
      {
        title: "Frozen hair whips cheeks",
        summary: `Frozen hair whips cheeks
Wind echoes in my helmet
Cocooned against the cold.`,
        tag: "Haiku",
      },
      {
        title: "Wind thrums lonely tones",
        summary: `Wind thrums lonely tones
A distant strange melody
A show, front row seats.`,
        tag: "Haiku",
      },
      {
        title: "Huddled down. Goggles on.",
        summary: `Huddled down. Goggles on.
My own eyes look back at me
Reflected in the lens.`,
        tag: "Haiku",
      },
      {
        title: "Goretex , PrimaLoft Gold.",
        summary: `Goretex , PrimaLoft Gold.
Wind and snow blow around me.
Yet I am dry, warm.`,
        tag: "Haiku",
      },
    ],
  },
];
