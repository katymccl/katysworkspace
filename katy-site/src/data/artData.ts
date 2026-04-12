export interface ArtPiece {
  id: string;
  src: string;
  name: string;
  description: string;
}

export interface SubCollection {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  pieces: ArtPiece[];
}

export interface ArtCollection {
  id: string;
  title: string;
  description: string;
  subCollections: SubCollection[];
}

export const artCollections: ArtCollection[] = [
  {
    id: "paintings",
    title: "Paintings",
    description: "Acrylic explorations",
    subCollections: [
      {
        id: "new-york-collection",
        title: "New York Collection",
        description: "A series of paintings inspired by the energy and diversity of New York City.",
        thumbnail: "/art/paintings/newyork-collection/piece-2.jpg",
        pieces: [
          {
            id: "paintings-6",
            src: "/art/paintings/newyork-collection/piece-2.jpg",
            name: "Just a dollar",
            description: "The contrast of NYC above and below.\nAcrylic on canvas, 2022.",
          },
                    {
            id: "paintings-5",
            src: "/art/paintings/newyork-collection/piece-1.jpg",
            name: "Rousseau's Dream Redux (The Jungle)",
            description: "An ode to Rousseau's Le Rêve.\nAcrylic on canvas, 2022.",

          },
        ],
      },
      {
        id: "french-collection",
        title: "French Collection",
        description: "A series of philosophical paintings exploring complex emotions and existential questions.",
        thumbnail: "/art/paintings/french-collection/piece1.jpg",
        pieces: [
          {
            id: "paintings-1",
            src: "/art/paintings/french-collection/piece1.jpg",
            name: "La Vie",
            description: "La beauté et les complexités de la vie.\nAcrylic on canvas, 2023.",
          },
          {
            id: "paintings-2",
            src: "/art/paintings/french-collection/piece2.jpg",
            name: "L'observateur",
            description: "Qui est l'observateur ?\nAcrylic on canvas, 2023.",
          },
          {
            id: "paintings-3",
            src: "/art/paintings/french-collection/piece3.jpg",
            name: "Tout et Rien",
            description: "Too many choices.\nAcrylic on canvas, 2023.",
          },
          {
            id: "paintings-4",
            src: "/art/paintings/french-collection/piece4.jpg",
            name: "L'amour",
            description: "Deux ne font qu'un.\nAcrylic on canvas, 2023.",
          },
        ],
      },
    ],
  },
  {
    id: "sketches",
    title: "Drawings",
    description: "Alcohol marker and acrylic pen sketches",
    subCollections: [
      {
        id: "drawings-main",
        title: "Cards",
        description: "A collection of sketches and drawings",
        thumbnail: "/art/drawings/cards/fathers.jpg",
        pieces: [
          {
            id: "sketches-1",
            src: "/art/drawings/cards/fathers.jpg",
            name: "Happy Father's Day",
            description: "Alcohol marker on paper, 2025",
          },
          {
            id: "sketches-2",
            src: "/art/drawings/cards/seasons.jpg",
            name: "Season's Greetings",
            description: "Alcohol marker on paper, 2025",
          },
          {
            id: "sketches-3",
            src: "/art/drawings/cards/coastguard.jpg",
            name: "Happy Birthday",
            description: "Alcohol marker on paper, 2025",
          },
          {
            id: "sketches-4",
            src: "/art/drawings/cards/annika.jpg",
            name: "Happy Birthday",
            description: "Alcohol marker on paper, 2023",
          },
                    {
            id: "sketches-5",
            src: "/art/drawings/cards/bday2.jpg",
            name: "Happy Birthday",
            description: "Alcohol marker on paper, 2023",
          },
                    {
            id: "sketches-6",
            src: "/art/drawings/cards/valentines1.jpg",
            name: "Happy Valentine's Day",
            description: "Alcohol marker on paper, 2024",
          },
                    {
            id: "sketches-7",
            src: "/art/drawings/cards/xmas1.jpg",
            name: "Happy Birthday",
            description: "Alcohol marker on paper, 2024",
          },
        ],
      },
      {
        id: "winter",
        title: "Winter",
        description: "A series of winter-inspired sketches and drawings",
        thumbnail: "/art/drawings/winter/love.jpg",
        pieces: [
          {
            id: "winter-1",
            src: "/art/drawings/winter/love.jpg",
            name: "You and I",
            description: "Alcohol marker on paper, 2025",
          },
                  {
            id: "winter-3",
            src: "/art/drawings/winter/bird.jpg",
            name: "Whistler Whiskey Jack",
            description: "Alcohol marker on paper, 2025",
          },
          {
            id: "winter-4",
            src: "/art/drawings/winter/bombtramchute.jpg",
            name: "Don't look down!",
            description: "Bomb Tram Chute, Sapphire Chutes, Whistler B.C. \nAlcohol marker on paper,  2026",
          },
          {
            id: "winter-5",
            src: "/art/drawings/winter/bombtramchute2.jpg",
            name: "Oh chute!",
            description: "Bomb Tram Chute, Sapphire Chutes, Whistler B.C. \nAlcohol marker on paper,  2026",
          },
           {
            id: "winter-6",
            src: "/art/drawings/winter/revy.jpg",
            name: "Good Night Revy",
            description: "Revekstoke B.C. \nAlcohol marker on paper,  2026",
          },
          {
            id: "winter-2",
            src: "/art/drawings/winter/dog.jpg",
            name: "Ski Patrol Pup",
            description: "Alcohol marker on paper, 2024",
          }
        ],
      },
    ],
  },
  {
    id: "Multi-media",
    title: "Multi-media",
    description: "Multi-media illustration and design",
    subCollections: [

      {
        id: "multi-media-main",
        title: "Multi-media",
        description: "A collection of Multi-media works",
        thumbnail: "/art/multi-media/jeansfront.jpg",
        pieces: [
          {
            id: "multi-media-1",
            src: "/art/multi-media/jeansfront.jpg",
            name: "I am the artist.",
            description: "A piece I did for a Halloween costume.\nAcrylic pens and POSCA markers on denim, 2025",
          },
          {
            id: "multi-media-2",
            src: "/art/multi-media/jeansback.jpg",
            name: "I am the artist.",
            description: "A piece I did for a Halloween costume.\nAcrylic pens and POSCA markers on denim, 2025.",
          },
          {
            id: "multi-media-3",
            src: "/art/multi-media/hands.jpg",
            name: "Immersive painting",
            description: "When in doubt, your hands are your best paintbrush. Acrylic. 2022.",
          },
        ],
      },
    ],
  },
];
