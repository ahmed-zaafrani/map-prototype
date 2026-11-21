// data.js
// ---------------------------------------------------------------
// The list of buildings on the map.
// Coordinates come from OpenStreetMap (the centre of each building).
//
// Each building has:
//   id          - a short unique name used in code and in saved progress
//   name        - what the user sees once it's unlocked
//   lat, lng    - position on the map
//   color       - colour of its zone once unlocked
//   icon        - small picture inside the pin (see ICON_PATHS in app.js):
//                 gate, columns, book, chip, sigma, people, chart
//   description - one sentence shown in the bottom card
//   tags        - little labels shown in the bottom card
//
// To add a building, copy one block and change the values.
// ---------------------------------------------------------------

const BUILDINGS = [
  {
    id: "roddick",
    name: "Roddick Gates",
    lat: 45.503849, lng: -73.574925,
    color: "#ED1B2F",
    icon: "gate",
    description: "The main entrance to the downtown campus, on Sherbrooke Street.",
    tags: ["Landmark", "Entrance", "Photo spot"],
  },
  {
    id: "arts",
    name: "Arts Building",
    lat: 45.505281, lng: -73.577692,
    color: "#F59E0B",
    icon: "columns",
    description: "McGill's oldest building, at the top of the main lower field.",
    tags: ["Historic", "Faculty of Arts", "Lectures"],
  },
  {
    id: "mclennan",
    name: "McLennan Library",
    lat: 45.503267, lng: -73.575937,
    color: "#10B981",
    icon: "book",
    description: "The main humanities and social sciences library, joined to Redpath.",
    tags: ["Library", "Study spots", "Quiet zones"],
  },
  {
    id: "trottier",
    name: "Trottier Building",
    lat: 45.507378, lng: -73.579032,
    color: "#3B82F6",
    icon: "chip",
    description: "Home to Computer Science and Electrical Engineering.",
    tags: ["Engineering", "Computer Science", "Study spots"],
  },
  {
    id: "burnside",
    name: "Burnside Hall",
    lat: 45.504716, lng: -73.574940,
    color: "#8B6CF0",
    icon: "sigma",
    description: "The concrete tower for Mathematics, Statistics and Geography.",
    tags: ["Science", "Mathematics", "Lectures"],
  },
  {
    id: "leacock",
    name: "Leacock Building",
    lat: 45.504617, lng: -73.578198,
    color: "#14B8A6",
    icon: "columns",
    description: "One of the busiest teaching buildings, with many Arts departments.",
    tags: ["Arts", "Lectures", "Classrooms"],
  },
  {
    id: "ssmu",
    name: "SSMU University Centre",
    lat: 45.503543, lng: -73.578162,
    color: "#F97316",
    icon: "people",
    description: "The Students' Society building, also called the Shatner Building.",
    tags: ["Student life", "Clubs", "Events"],
  },
  {
    id: "bronfman",
    name: "Bronfman Building",
    lat: 45.502543, lng: -73.576451,
    color: "#E11D48",
    icon: "chart",
    description: "Home of the Desautels Faculty of Management.",
    tags: ["Management", "Business", "Classrooms"],
  },
];
