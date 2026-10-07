// Menu shapes for the in-world menu book, plus the demo cafe's menu.
// A menu is shown page by page. A page is either a generated list of items or an image
// (a cafe can upload photos of its printed menu instead of typing every item).

/** How a menu item is drawn when it has no photo. */
export interface DrinkArt {
  glass: "iced" | "hot" | "plate";
  /** Colours from the bottom of the glass up (a plate uses them for the food). */
  layers: string[];
  topping?: "cream" | "foam" | "orange" | "lemon" | "mint" | "caramel" | "art";
}

export interface MenuItemView {
  id: string;
  name: string;
  /** Price in rupiah. */
  price: number;
  description?: string | null;
  imageUrl?: string | null;
  art?: DrinkArt;
  isAvailable?: boolean;
}

export interface MenuCategoryView {
  id: string;
  name: string;
  items: MenuItemView[];
}

export type MenuPage =
  | { kind: "list"; title: string; items: MenuItemView[] }
  | { kind: "image"; title: string; src: string };

export interface MenuView {
  categories: MenuCategoryView[];
  /** Uploaded menu pages (photos). When present they come before the generated list pages. */
  imagePages?: { title: string; src: string }[];
}

/** Split a menu into pages: image pages first, then each category in chunks of `perPage` items. */
export function menuPages(menu: MenuView, perPage = 8): MenuPage[] {
  const pages: MenuPage[] = (menu.imagePages ?? []).map((p) => ({ kind: "image", title: p.title, src: p.src }));
  for (const c of menu.categories) {
    const items = c.items.filter((i) => i.isAvailable !== false);
    const chunks = Math.max(1, Math.ceil(items.length / perPage));
    for (let i = 0; i < chunks; i++) {
      pages.push({ kind: "list", title: chunks > 1 ? `${c.name} (${i + 1}/${chunks})` : c.name, items: items.slice(i * perPage, (i + 1) * perPage) });
    }
  }
  return pages;
}

export const formatRupiah = (n: number) => (n % 1000 === 0 ? `${n / 1000}k` : `Rp${n.toLocaleString("id-ID")}`);

const ESPRESSO = "#3b1d0e";
const COFFEE = "#7a4a2a";
const MILK = "#f4ead9";
const LATTE = "#c69c6d";
const CHOCO = "#5a3220";
const MATCHA = "#7fae5a";
const ICE = "#e0f2fe";

const item = (id: string, name: string, price: number, art: DrinkArt, description?: string): MenuItemView => ({ id, name, price, art, description });

/** The menu of the "cafe-a" demo venue, shared by the database seed and the static demo. */
export const DEMO_MENU: MenuView = {
  categories: [
    {
      id: "kopi-dingin",
      name: "Kopi Dingin",
      items: [
        item("ice-kopi-susu", "Kopi Susu Gula Aren", 25000, { glass: "iced", layers: [MILK, LATTE, COFFEE] }, "Andalan rumah, manis gula aren"),
        item("ice-americano", "Americano", 22000, { glass: "iced", layers: [ESPRESSO, ESPRESSO] }),
        item("ice-latte", "Latte", 26000, { glass: "iced", layers: [MILK, MILK, COFFEE] }),
        item("ice-cappuccino", "Cappuccino", 26000, { glass: "iced", layers: [LATTE, LATTE], topping: "foam" }),
        item("ice-mocha", "Mocha", 28000, { glass: "iced", layers: [CHOCO, LATTE], topping: "cream" }),
        item("ice-caramel", "Caramel Macchiato", 30000, { glass: "iced", layers: [MILK, MILK, COFFEE], topping: "caramel" }),
        item("ice-coconut", "Coconut Pudding Latte", 32000, { glass: "iced", layers: ["#fff7e6", MILK, COFFEE] }),
      ],
    },
    {
      id: "kopi-panas",
      name: "Kopi Panas",
      items: [
        item("hot-espresso", "Espresso", 18000, { glass: "hot", layers: [ESPRESSO] }),
        item("hot-americano", "Americano", 20000, { glass: "hot", layers: [COFFEE] }),
        item("hot-latte", "Latte", 24000, { glass: "hot", layers: [LATTE], topping: "art" }),
        item("hot-cappuccino", "Cappuccino", 24000, { glass: "hot", layers: [LATTE], topping: "foam" }),
        item("hot-mocha", "Mocha", 26000, { glass: "hot", layers: [CHOCO], topping: "art" }),
        item("hot-caramel", "Caramel Macchiato", 28000, { glass: "hot", layers: [LATTE], topping: "caramel" }),
      ],
    },
    {
      id: "black-segar",
      name: "Black Coffee Segar",
      items: [
        item("black-honey-lemon", "Black Honey Lemon", 28000, { glass: "iced", layers: ["#f6e7a1", ESPRESSO], topping: "lemon" }),
        item("black-orange", "Black Orange", 28000, { glass: "iced", layers: ["#f59e0b", ESPRESSO], topping: "orange" }),
        item("black-peach", "Black Peach", 28000, { glass: "iced", layers: ["#f7b38a", ESPRESSO], topping: "orange" }),
        item("black-yuzu", "Black Yuzu", 30000, { glass: "iced", layers: ["#fde68a", ESPRESSO], topping: "lemon" }),
        item("black-coconut", "Black Coconut", 30000, { glass: "iced", layers: [ICE, ESPRESSO], topping: "mint" }),
      ],
    },
    {
      id: "non-kopi",
      name: "Non-Kopi",
      items: [
        item("matcha-latte", "Matcha Latte", 30000, { glass: "iced", layers: [MILK, MATCHA] }),
        item("green-tea-latte", "Green Tea Latte", 26000, { glass: "hot", layers: ["#a7c98a"], topping: "art" }),
        item("chocolate", "Chocolate", 25000, { glass: "iced", layers: [CHOCO, CHOCO], topping: "cream" }),
        item("white-chocolate", "White Chocolate", 26000, { glass: "iced", layers: [MILK, "#fff7e6"], topping: "cream" }),
        item("thai-tea", "Thai Tea Latte", 24000, { glass: "iced", layers: ["#f08a3c", "#f08a3c"], topping: "foam" }),
        item("choco-mint", "Chocolate Mint", 26000, { glass: "iced", layers: ["#a7e3c4", CHOCO], topping: "mint" }),
        item("pink-milk", "Pink Milk", 22000, { glass: "iced", layers: ["#f9a8d4", MILK] }),
        item("lemon-tea", "Lemon Tea", 20000, { glass: "iced", layers: ["#f59e0b", "#f97316"], topping: "lemon" }),
        item("hot-milk", "Susu Hangat", 18000, { glass: "hot", layers: [MILK] }),
      ],
    },
    {
      id: "makanan",
      name: "Makanan",
      items: [
        item("croissant", "Croissant", 20000, { glass: "plate", layers: ["#e0a24e", "#c47a2c"] }),
        item("nasi-goreng", "Nasi Goreng Kampung", 35000, { glass: "plate", layers: ["#d9893a", "#f8fafc"] }),
        item("roti-bakar", "Roti Bakar Cokelat", 22000, { glass: "plate", layers: ["#d6a05a", CHOCO] }),
        item("kentang", "Kentang Goreng", 20000, { glass: "plate", layers: ["#f6c453", "#e8a93a"] }),
      ],
    },
  ],
};
