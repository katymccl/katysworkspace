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
        title: "I cooked and you cleaned.",
        summary: `I cooked and you cleaned.
To a classic rock lullaby.
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
  {
    id: "poems",
    label: "Longer poems",
    description: "Poetry beyond the haiku—reflections on time, connection, and the spaces in between.",
    items: [
      {
        title: "Perceived Expectations",
        summary: `
Perceived expectations of what it means to be great,
Triggers doubts and fears of not ever being enough.
What if, what if you freed yourself of this long held weight?

Two planks lie ready on the mountain top as they wait.
Eyes search for safe lines and soft snow hidden amongst slough.
Perceived expectations of what it means to be great.

Did you deserve to pass through the double diamond gate?
Skiing - supposed to be fun, but it's so mentally tough.
What if, what if you freed yourself of this long held weight?

The sun shines on big mountains only dreams can create;
Making even moguls shine as diamonds in the rough.
Perceived expectations of what it means to be great.

A deep burning desire which only skiing can satiate;
Boots click into bindings and then she's gone with a puff.
What if, what if you freed yourself of this long held weight?

She emerges from a white cloud with a playful gait;
Joy fills her face as she finds she's already enough.
Perceived expectations of what it means to be great
What if, what if you freed yourself of this long held weight?`,
        tag: "Poem",
      },
      {
        title: "Ski just for me",
        summary: `Sometimes I'm skiing,
And it comes into being - 
That my face has contorted in pure delight.
A smile so big, eyes shining so bright.

No matter if the snow is just a sheet of ice; 
Or riddled with rocks, which isn't so nice;
The joy of skiing pervades time and space.
Take your time down the slopes, it isn't a race.

There's a pillow over there, calling your name.
Line up the jump, get stoked and take aim.

They say the mountain is like a blank canvas in snow. 
But for me I see lines and features far down below.
On the chairlift I scheme and plot my attack.
Chasing dreams and objectives, not looking back.

Last year I said next time I'll ski just for me.
No outward pressure, just me and my skis.

This year I've done not only that but more.
I've gone back to old places, but still found room to explore.
My heart and my head have long battled the other.
But on the mountain they align, stronger together.

I used to wonder if I could ski alone.
It was a paralyzing fear, a daunting unknown.
Would it still be fun? What's even the point without you?

The mountains fill me with something, sometimes too big to contain.
I long to share this feeling, to try to explain.
But one thing I learned this year in Salt Lake,
Sometimes, my energy is too much for others to take.

Just like goggles change the way you see,
Others view the mountain in different ways than me.

And that's okay if they have conflicting goals.
Even if they don't use poles.

They're still out there sliding down the same hills as me.
Different elements of the mountains filling us with glee.

So now I try to encourage but leave room for imperfections.
In myself and in others, a different direction.

I've gathered the courage to ski by myself when it's needed.
Realizing if I didn't then I'd be defeated.

At first it was scary, like dropping off a huge cliff.
It was lonely and boring all alone on the chair lift.

But each run as I checked off challenges on my list.
I also found surprises that I formerly missed.
Secret pow stashes, hidden routes through the trees-
The mountain is full of joyful opportunities.
McKonkey's Couloir all to myself in the storm.
A freedom of sorts, no need to conform.
A discovery of inner strength and fiery joy.
A crisp alignment, like fresh groomed corduroy.

So now when I'm skiing,
I find myself believing.
As my face contorts in pure delight.
A smile so big, eyes shining so bright.

I've found love for myself as I am in skiing.
Enough that I know I'll never stop dreaming.
`,
tag: "Poem",
      },
      {
        title: "Breaking Trails",
        summary: `Sometimes I’m just sitting,
And all that I can see;
Is lines,
Darting in and out of trees.

S-curves carved on sweeping faces of white.
Winter’s immaculate gown, a magical sight.

I see you ahead, leaving cold smoke behind.
But if I follow too closely, your trail leaves me blind.

I call out to you saying “Hey-  wait for me!”
But you disappear through a gap in the trees.

I find myself left tracing two parallel lines.
They will never meet; and you will never be mine.

I come out of dream state, reflecting back on the past.
What I never saw coming, that final icy blast. 

It’s hard to continue, not knowing what’s ahead.
But now I know better, I will not be led.

It is me who is strong,
It was me all along.

When I thought you were the teacher, I had it all wrong.

What I have learned, I have learned from myself. 
Photos of you covered in dust on the shelf.

You always talked about breaking trails. 
But I think you may have missed just a few details. 

A partnership demands a close understanding.
Knowing if I jump, you’ll be there for the landing.

But just like the snowpack can break in an instant,
Lies and harsh words render trust nonexistent.

So now I’m sitting, again staring blank.
And this time I see just me and my planks.

I am soaring down a crystal edged spine.
Leaping and bouncing through a beautiful line.

The beauty of snow is that it helps you forget.
Fresh mountain air is the perfect reset.

Perhaps all along my heart was indeed true.
But I know now, it was not for you.

I see a gap in two trees ahead on my trail.
This time I charge forward to slip through the veil.

And do you know what I found on the other side?
My heart was filled with a bursting pride.

The path ahead is mine to choose. 
What’s lost is gone, I have nothing to lose. 

Next time I ride the chairlift, I’ll be filled with glee.
Because now’s my time to ski just for me.
`,
        tag: "Poem",
      },
      {
        title: "Winter Ballet",
        summary: `Right, left; tips pointed straight down.
Scrape, slosh; the very best sounds.
Bend, pop; get ready to fly.
Light, still; at one with the sky.
Spin, flip; its freedom we seek.
Shout, cry; best night of the week.
Whoosh, thump  ; return to the ground.
Dreams, hope; contentment is found.
Drip, drop; winter is leaving.
Wait, stop; i'm still here grieving.
Spines, slabs; they're starting to crack.
Change, break; she says I'll be back.
Love, people; thats my favorite part.
Smiles, voices; forever in my heart.
Hike, climb; summer comes to play.
Wait, dream; for my winter ballet.`,
        tag: "Poem",
      },
      {
        title: "American Dreams",
        summary: `She isn't perfect. 
But her flag flies high today.
I am so grateful for this land. 

Sometimes I forget
Just how much I have to love
In the good ol' USA.

What a dream they had effected
Our Intrepid founding fathers- 
A bold experiment for man.

Today we are connected 
Celebrating her
Two hundred forty seventh
Birthday and freedom.
With  hope that her flag will fly high, come what may.

It's easy to neglect who has protected Our certain unalienable Rights. 
That those Rights are inevitable and they are not worth a fight. 

I struggle with what it means to be an American. 
I am lucky to be born here with keys to a bright future, though on no merit of my own, but on those that came before me. 

Sometimes I am wrong.
And I don't have all the answers.
But whatever happens next, I hope we all can see that everyone deserves a life of liberty.  

Today I reread the words of 5 great men. Jefferson, Adams, Franklin, Livingston, and Sherman. 
I was struck by their reminder of man's complacency for suffering. 

"But when a long train of abuses and usurpations, pursuing invariably the same Object evinces a design to reduce them under absolute Despotism, it is their right, it is their duty, to throw off such Government, and to provide new Guards for their future security."

So what does it mean to be American?
I think it's a little bit more than a land of opportunity. 
It's a deep respect and accountability of everyone to uphold the American dream.
And a duty to preserve our  beloved unalienable Rights.

I hope that when it comes time to act, we stand-up for those bold ideas signed into a pact. 
After all, it was Americans who had the bold audacity to tell a tyrant king,
That he absolutely no longer had their consent.
`,
        tag: "Poem",
      },
      {
        title: "Here lies, all of you",
        summary: `here lies, all of you.
rest here, you are not forgotten.
bodies young, but minds are rotten.
tendrils of doubt like weak layers.
lurking just beneath the snow.
heard lies, straight from you.

here lies, all of you.
fear not, dark vines of subterfuge
wind thick enough to cover you.
they try to reach out and grab me
as I ski upon your grave

here lies, all of you.
think not, that sins will be exhumed.
forgiveness is like wind and snow
storms which heal crevasses of the soul
a pristine cover of white.

here lies, all of you.
always, you'll be a part of me.
crack. crumble. boom. fall. avalanche.
`,
        tag: "Poem",
      },
      {
        title: "Together but separate eyes",
        summary: `Take me to where the wild snake river runs free;
Walk with me, but don’t tell me what my eyes see;
There is magic here, to some remains unknown;
A holistic gathering upon nature’s throne.

I can see the valleys, the mountains far and wide;
Such a grand sight, feeling - when I left I cried;
I yelled and screamed but made not a sound;
I could not comprehend a place so profound.

Do you know the place which I have recalled?
Is it deep in your soul? Carefully kept walled?
Hold my hand and tread lightly up to the sky;
We are together now, but soon we have to fly.

Same place but different eyes; I know we must part;
To truly  find the beauty this place fills our hearts.
`,
        tag: "Poem",
      },
      {
        title: "The Shower",
        summary: `Showering at my grandmother’s house 
What an odd thing to miss,
Such a mundane thing; with so much feeling 
Showering at Grammy’s beach house. 

The window is open to the humid sea air 
The clothes on the line flutter in the humid breeze. 
Maybe you've just been told to shower; to prepare yourself for dinner. 
Or maybe you've claimed this spot as your own in a race to become clean and dry again.
Or maybe you've come running in, sand still in your swimsuit after a soggy car ride home from the beach.

The shower itself is not so magical. 
It washes away west coast jet lag 
Or perhaps sandy feet.
Sweaty bits. 
From long days outside under the eastern sky. 

The drain suffers from the wear of salt washing down the drain. 
Remnants of cousins who came before exist on the shower shelves. 
Random containers of mismatched shampoos and conditioners. 

This is the shower I probably bathed in as a child and yet I bathed my niece in now. 
This shower has seen so many children grow up as its owners grew old. 
How many beach days has it washed children clean off? 
How many soft feet padded in, leaving small footprints of sand in the tile floors ?

You slide the foggy glass door to emerge.
A sweet smell of the sea greets you as steam drifts off your body 
You pull a well worn but soft towel from the rack which grips you in a hug. 
Tide. The classic scent. Envelopes you in a moment of calm. 

But then you hurry to dry off quickly 
Others are waiting for the shower. 
Their voices are muffled outside, 
The tv upstairs masking their conversations. 

For a moment, it's just you. 
You stare into the mirror. 
You breathe in the humid air. 
You hear the lighthouse singing its lulling lonely tone.
 If you listen hard enough, you might just hear the distant waves.

You wonder at how you got here. 
At the stories told and those you'll never know. 
You hope that you'll remember the love that you feel wrapped in that towel. 
The clinging comfort of the languid humidity. 
As you finish drying from your shower,
You look inside the bathroom cabinet for a Q-Tip:
There is a gentle organized menagerie of towel sets.
The kind that's been used but still can dry.

There is an apothecary of travel sized shampoos and soaps. 
Extra toothbrushes. Bandaids. 
And then there's the reminders of age; the bandages and medicines which signal past maligns. 
You know it's happened but remains unspoken, 
A careful, Fabricated lullaby, But there it is, proof, that you're not quite a kid anymore. 

The door closes; clicks shut with a magnet;
The darkness gone with it. 
You look back once more at the screened window. 
A lawn mower sounds across the way. 
It’s Saturday and the island is living. 

“Miss Kathryn” she calls from the kitchen above. 
Pits and privates scrubbed clean as directed 
It's time to return to the family hubbub. 

Hair starts to curl as it dries in the sea air. 
As I climb the stairs I can smell dinner cooking 
Fox News is blaring, 
Maybe Tour de France.
But truthfully I wouldn’t have it any other way. 

The evening sun streams in through the windows.
Showers at grammys aren’t quite like another.
It’s a moment of respite but a moment to ponder. 
Such a normalcy and a necessary act
But one I would now pay to reenact.
`,
        tag: "Poem",
      },
      {
        title: "Ode to Winter",
        summary: `We are waiting.
It is quiet here.
We are waiting, bated breath.
Listen to the first flakes fall.
Agitation.
Anticipation.
Exhilaration. 
We are waiting, watching closely.
The winter sun already shines.
We are waiting, softly dreaming.
Can you hear the ski lifts running?
Frustration.
Impatience.
Aspiration.
We are waiting, what will come?
Who will we become?
We are waiting,  working hard.
Skis are tuned, waxed and ready.
Here.
Soon.
Now.
We are waiting, we laugh and cry
We are waiting.
We are waiting to fly.
`, tag: "Poem",
      },
      {
        title: "A poem about winter sunsets",
        summary: `Before me there stretched a golden sea,
Gilded crests illuminated sun kissed clouds.
The light beckoned me with evening's sweet refrain,
Tendrils stretching from a magic land.
Gentle leviathans flirting with the darkening horizon.

Tears filled my eyes though not caused by grief.
Feeling so very small, and yet not afraid.
My heart -  full of calm, a deep quiet relief.
Everything, everyone and nothing.
Realizing the ephemeral moment I had just witnessed.

Within me a deep desire emerged.
To stretch and fly to this captivating land.
To treasure more moments in the dying light.
And never give up life's endless fight.
To live, love, laugh: unabashed and full as a mountain sunset.
`, tag: "Poem",
      }
    ],
  },
];
