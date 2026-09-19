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
  { id: "1", name: "Sora Breakfast", description: "Eggs, toasted bread, avocado, tomato and house potatoes.", price: 360, category: "Breakfast", popular: true, available: true, image: "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=900&q=80" },
  { id: "2", name: "Chechebsa Plate", description: "Warm spiced flatbread with clarified butter and house yogurt.", price: 290, category: "Breakfast", popular: true, available: true, image: "https://images.unsplash.com/photo-1546549032-9571cd6b27df?auto=format&fit=crop&w=900&q=80" },
  { id: "3", name: "Grilled Chicken Bowl", description: "Grilled chicken, herbed rice, seasonal greens and lemon dressing.", price: 520, category: "Mains", popular: true, available: true, image: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80" },
  { id: "4", name: "Classic Beef Burger", description: "Beef patty, cheddar, lettuce, tomato and signature sauce.", price: 480, category: "Mains", available: true, image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80" },
  { id: "5", name: "Macchiato", description: "Double espresso marked with a small layer of milk foam.", price: 95, category: "Coffee", popular: true, available: true, image: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=900&q=80" },
  { id: "6", name: "Cappuccino", description: "Espresso with steamed milk and dense microfoam.", price: 130, category: "Coffee", available: true, image: "https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&w=900&q=80" },
  { id: "7", name: "Passion Cooler", description: "Passion fruit, lime, mint and sparkling water.", price: 180, category: "Cold Drinks", available: true, image: "https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=900&q=80" },
  { id: "8", name: "Chocolate Cake", description: "Dark chocolate sponge with silky chocolate cream.", price: 240, category: "Dessert", available: true, image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=900&q=80" }
];
