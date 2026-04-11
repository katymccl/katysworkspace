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
        src: "/art/paintings/piece-1.jpg",
        name: "Piece Title",
        description: "A description of this piece — medium, inspiration, year.",
      },
      {
        id: "paintings-2",
        src: "/art/paintings/piece-2.jpg",
        name: "Piece Title",
        description: "A description of this piece — medium, inspiration, year.",
      },
      {
        id: "paintings-3",
        src: "/art/paintings/piece-3.jpg",
        name: "Piece Title",
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
