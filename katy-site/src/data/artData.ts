export interface ArtPiece {
  id: string;
  src: string;
  name: string;
  description: string;
}

export interface ArtCollection {
  id: string;
  title: string;
  description: string;
  pieces: ArtPiece[];
}

export const artCollections: ArtCollection[] = [
  {
    id: "paintings",
    title: "Paintings",
    description: "Oil and acrylic explorations",
    pieces: [
      {
        id: "paintings-1",
        src: "/art/paintings/french-collection/piece1.jpg",
        name: "La Vie",
        description: "A description of this piece — medium, inspiration, year.",
      },
      {
        id: "paintings-2",
        src: "/art/paintings/french-collection/piece2.jpg",
        name: "Les Temps",
        // eslint-disable-next-line max-len
        description: "What is time? If both you and I are the observer, who is observing us? Acrylic on canvas, 2023.",
      },
      {
        id: "paintings-3",
        src: "/art/paintings/french-collection/piece3.jpg",
        name: "Tout et Rien",
        description: "A description of this piece — medium, inspiration, year.",
      },
    ],
  },
  {
    id: "sketches",
    title: "Sketches",
    description: "Pencil, ink, and line work",
    pieces: [
      {
        id: "sketches-1",
        src: "/art/sketches/piece-1.jpg",
        name: "Piece Title",
        description: "A description of this piece — medium, inspiration, year.",
      },
      {
        id: "sketches-2",
        src: "/art/sketches/piece-2.jpg",
        name: "Piece Title",
        description: "A description of this piece — medium, inspiration, year.",
      },
      {
        id: "sketches-3",
        src: "/art/sketches/piece-3.jpg",
        name: "Piece Title",
        description: "A description of this piece — medium, inspiration, year.",
      },
    ],
  },
  {
    id: "digital",
    title: "Digital",
    description: "Digital illustration and design",
    pieces: [
      {
        id: "digital-1",
        src: "/art/digital/piece-1.jpg",
        name: "Piece Title",
        description: "A description of this piece — medium, inspiration, year.",
      },
      {
        id: "digital-2",
        src: "/art/digital/piece-2.jpg",
        name: "Piece Title",
        description: "A description of this piece — medium, inspiration, year.",
      },
      {
        id: "digital-3",
        src: "/art/digital/piece-3.jpg",
        name: "Piece Title",
        description: "A description of this piece — medium, inspiration, year.",
      },
    ],
  },
];
