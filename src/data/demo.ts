export type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
  popular?: boolean;
  available?: boolean;
};

export const restaurant = {
  name: "Sora Table",
  tagline: "Fresh plates • coffee • good company",
  location: "Addis Ababa • Demo restaurant",
  hours: "Open today · 7:00 AM–10:00 PM",
  currency: "ETB",
};

export const categories = ["Popular", "Breakfast", "Mains", "Coffee", "Cold Drinks", "Dessert"];

export const menuItems: MenuItem[] = [
  { id: "1", name: "Sora Breakfast", description: "Eggs, toasted bread, avocado, tomato and house potatoes.", price: 360, category: "Breakfast", popular: true, available: true, image: "/migrated-media/4d3cc5e2211a4f1e2e6c16aa.jpg" },
  { id: "2", name: "Chechebsa Plate", description: "Warm spiced flatbread with clarified butter and house yogurt.", price: 290, category: "Breakfast", popular: true, available: true, image: "/migrated-media/26ab3aca8f003a18f037e489.jpg" },
  { id: "3", name: "Grilled Chicken Bowl", description: "Grilled chicken, herbed rice, seasonal greens and lemon dressing.", price: 520, category: "Mains", popular: true, available: true, image: "/migrated-media/b6fc15f0728183f4248e1a1e.jpg" },
  { id: "4", name: "Classic Beef Burger", description: "Beef patty, cheddar, lettuce, tomato and signature sauce.", price: 480, category: "Mains", available: true, image: "/migrated-media/80f3fae3df2548fb14c62bb6.jpg" },
  { id: "5", name: "Macchiato", description: "Double espresso marked with a small layer of milk foam.", price: 95, category: "Coffee", popular: true, available: true, image: "/migrated-media/d795852aa641d68c884dd4c2.jpg" },
  { id: "6", name: "Cappuccino", description: "Espresso with steamed milk and dense microfoam.", price: 130, category: "Coffee", available: true, image: "/migrated-media/e222c0c202a451311c5e138f.jpg" },
  { id: "7", name: "Passion Cooler", description: "Passion fruit, lime, mint and sparkling water.", price: 180, category: "Cold Drinks", available: true, image: "/migrated-media/dcbee92b3f3c839a395993e5.jpg" },
  { id: "8", name: "Chocolate Cake", description: "Dark chocolate sponge with silky chocolate cream.", price: 240, category: "Dessert", available: true, image: "/migrated-media/f84a387355f78b549c97bad8.jpg" }
];
