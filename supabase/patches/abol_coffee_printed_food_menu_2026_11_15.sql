-- Abol Coffee content correction prepared from two photographed printed food-menu pages, 2026-11-15.
-- REVIEW BEFORE RUNNING ON PRODUCTION. This is a manual patch, not an automatically applied migration.
-- The printed prices may need restaurant approval as the current selling prices.
-- Scope: Abol Coffee only. No changes to colors, fonts, layout, other tenants, drinks or desserts.
-- Run after production backup. Idempotent by restaurant/name; no deletes.
-- Unclear photo data (e.g. BBQ Chicken Wings price) deliberately excluded.
begin;
do $$
begin
 if (select count(*) from public.restaurants where slug='abol-coffee') <> 1 then
   raise exception 'Expected exactly one abol-coffee restaurant';
 end if;
end $$;

-- Add only missing printed food categories; preserve all 13 original categories.
insert into public.categories (restaurant_id,name,sort_order,is_active)
select r.id,c.name,c.sort_order,true from public.restaurants r
cross join (values ('Grill',14),('Salads',15)) as c(name,sort_order)
where r.slug='abol-coffee'
and not exists (select 1 from public.categories existing where existing.restaurant_id=r.id and lower(existing.name)=lower(c.name));

-- Exact spelling aliases found in the earlier September seed.
-- Preserve existing IDs and relationships; don't create duplicate old/new names.
update public.menu_items m set name=aliases.new_name, updated_at=now()
from public.restaurants r,
(values
  ('Scrambled Egg','Scrambled Eggs'),
  ('Beef Burger','Abol Beef Burger'),
  ('Cheese Burger','Abol Cheeseburger'),
  ('Double Cheese Burger','Double Cheeseburger')
) as aliases(old_name,new_name)
where m.restaurant_id=r.id and r.slug='abol-coffee'
and lower(m.name)=lower(aliases.old_name)
and not exists (select 1 from public.menu_items x where x.restaurant_id=m.restaurant_id and lower(x.name)=lower(aliases.new_name));

with printed(name,price,category,description) as (values
  ('Healthy Breakfast Combo', 600, 'Breakfast', ''),
  ('Full English Breakfast', 820, 'Breakfast', ''),
  ('Avocado Toast', 400, 'Breakfast', ''),
  ('Tuna Melt', 900, 'Breakfast', ''),
  ('Plain Omelette', 360, 'Breakfast', ''),
  ('Special Omelette', 480, 'Breakfast', ''),
  ('Beef Omelette', 430, 'Breakfast', ''),
  ('Scrambled Eggs', 400, 'Breakfast', ''),
  ('Egg Sandwich', 370, 'Breakfast', ''),
  ('Cinnamon French Toast', 450, 'Breakfast', ''),
  ('Waffles', 500, 'Breakfast', ''),
  ('Pancakes', 500, 'Breakfast', ''),
  ('Cheese Croissant', 500, 'Breakfast', ''),
  ('Croissant with Cheese & Egg', 650, 'Breakfast', ''),
  ('Chechebsa with Honey', 329, 'Breakfast', ''),
  ('Ful (Normal)', 349, 'Breakfast', ''),
  ('Special Ful', 399, 'Breakfast', ''),
  ('Cheese Steak Sandwich', 850, 'Sandwiches', ''),
  ('Chicken Sandwich', 850, 'Sandwiches', ''),
  ('Club Sandwich', 1099, 'Sandwiches', ''),
  ('Veggie Sandwich', 349, 'Sandwiches', ''),
  ('Chicken Wrap', 1000, 'Sandwiches', ''),
  ('Beef Wrap', 900, 'Sandwiches', ''),
  ('Tuna Wrap', 1000, 'Sandwiches', ''),
  ('Falafel Wrap', 499, 'Sandwiches', ''),
  ('Abol Tibs', 900, 'Traditional Food', ''),
  ('Abol Combo', 1550, 'Traditional Food', ''),
  ('Tibs Firfir', 600, 'Traditional Food', ''),
  ('Quanta Firfir', 600, 'Traditional Food', ''),
  ('Bozena Shiro', 550, 'Traditional Food', ''),
  ('Fasting Combo', 600, 'Traditional Food', ''),
  ('Fasting Firfir', 379, 'Traditional Food', ''),
  ('Shiro', 350, 'Traditional Food', ''),
  ('Tegabino', 499, 'Traditional Food', ''),
  ('Quarter Roasted Chicken', 1800, 'Grill', 'Served with 1 side. Choose from fries, mashed potatoes, cooked vegetables or rice. Peri Peri sauce.'),
  ('Half Roasted Chicken', 3500, 'Grill', 'Served with 2 sides. Choose from fries, mashed potatoes, cooked vegetables or rice. Peri Peri sauce.'),
  ('Full Roasted Chicken', 6500, 'Grill', 'Served with 4 sides. Choose from fries, mashed potatoes, cooked vegetables or rice. Peri Peri sauce.'),
  ('Chicken Fettuccine', 1000, 'Pasta', 'In a creamy pink sauce.'),
  ('Bolognese', 600, 'Pasta', ''),
  ('Vegetable Pasta', 370, 'Pasta', ''),
  ('Tomato Pasta', 400, 'Pasta', ''),
  ('Arrabbiata', 400, 'Pasta', ''),
  ('Vegetable Noodles', 500, 'Pasta', ''),
  ('Beef Noodles', 750, 'Pasta', ''),
  ('Chicken Noodles', 800, 'Pasta', ''),
  ('Chicken Bowl', 1100, 'Bowls & Wings', 'Rice, avocado guacamole, tomato salad, chickpeas and Abol sauce.'),
  ('Beef Bowl', 899, 'Bowls & Wings', 'Rice, avocado guacamole, tomato salad, chickpeas and Abol sauce.'),
  ('Veggie Bowl', 499, 'Bowls & Wings', 'Rice, avocado guacamole, tomato salad, chickpeas and Abol sauce.'),
  ('Margherita Pizza', 699, 'Burgers & Pizza', ''),
  ('Beef Pizza', 879, 'Burgers & Pizza', ''),
  ('Tuna Pizza', 899, 'Burgers & Pizza', ''),
  ('Special Pizza', 1100, 'Burgers & Pizza', ''),
  ('Veggie Pizza', 499, 'Burgers & Pizza', ''),
  ('Chicken Pizza', 1000, 'Burgers & Pizza', ''),
  ('Turkish Pizza', 1000, 'Burgers & Pizza', ''),
  ('Abol Beef Burger', 620, 'Burgers & Pizza', ''),
  ('Abol Cheeseburger', 680, 'Burgers & Pizza', ''),
  ('Double Cheeseburger', 810, 'Burgers & Pizza', ''),
  ('Chicken Burger', 1100, 'Burgers & Pizza', ''),
  ('Falafel Burger', 400, 'Burgers & Pizza', ''),
  ('Chicken & Waffles', 1000, 'Sides', ''),
  ('Loaded Fries', 450, 'Sides', 'With Abol house sauces and melted cheese.'),
  ('Falafel with Chips', 400, 'Sides', ''),
  ('Mixed Salad', 350, 'Salads', ''),
  ('Tuna Salad', 600, 'Salads', ''),
  ('Chicken Salad', 900, 'Salads', '')
), target as (
 select r.id restaurant_id,c.id category_id,p.name,p.price,p.description
 from printed p join public.restaurants r on r.slug='abol-coffee'
 join public.categories c on c.restaurant_id=r.id and lower(c.name)=lower(p.category)
)
-- Update the product already in the database. Preserve photos and popular flags.
update public.menu_items m
set price=t.price, category_id=t.category_id,
    description=case when nullif(t.description,'') is not null then t.description else m.description end,
    updated_at=now()
from target t
where m.restaurant_id=t.restaurant_id and lower(m.name)=lower(t.name)
and (m.price is distinct from t.price or m.category_id is distinct from t.category_id
     or (nullif(t.description,'') is not null and m.description is distinct from t.description));

with printed(name,price,category,description) as (values
  ('Healthy Breakfast Combo', 600, 'Breakfast', ''),
  ('Full English Breakfast', 820, 'Breakfast', ''),
  ('Avocado Toast', 400, 'Breakfast', ''),
  ('Tuna Melt', 900, 'Breakfast', ''),
  ('Plain Omelette', 360, 'Breakfast', ''),
  ('Special Omelette', 480, 'Breakfast', ''),
  ('Beef Omelette', 430, 'Breakfast', ''),
  ('Scrambled Eggs', 400, 'Breakfast', ''),
  ('Egg Sandwich', 370, 'Breakfast', ''),
  ('Cinnamon French Toast', 450, 'Breakfast', ''),
  ('Waffles', 500, 'Breakfast', ''),
  ('Pancakes', 500, 'Breakfast', ''),
  ('Cheese Croissant', 500, 'Breakfast', ''),
  ('Croissant with Cheese & Egg', 650, 'Breakfast', ''),
  ('Chechebsa with Honey', 329, 'Breakfast', ''),
  ('Ful (Normal)', 349, 'Breakfast', ''),
  ('Special Ful', 399, 'Breakfast', ''),
  ('Cheese Steak Sandwich', 850, 'Sandwiches', ''),
  ('Chicken Sandwich', 850, 'Sandwiches', ''),
  ('Club Sandwich', 1099, 'Sandwiches', ''),
  ('Veggie Sandwich', 349, 'Sandwiches', ''),
  ('Chicken Wrap', 1000, 'Sandwiches', ''),
  ('Beef Wrap', 900, 'Sandwiches', ''),
  ('Tuna Wrap', 1000, 'Sandwiches', ''),
  ('Falafel Wrap', 499, 'Sandwiches', ''),
  ('Abol Tibs', 900, 'Traditional Food', ''),
  ('Abol Combo', 1550, 'Traditional Food', ''),
  ('Tibs Firfir', 600, 'Traditional Food', ''),
  ('Quanta Firfir', 600, 'Traditional Food', ''),
  ('Bozena Shiro', 550, 'Traditional Food', ''),
  ('Fasting Combo', 600, 'Traditional Food', ''),
  ('Fasting Firfir', 379, 'Traditional Food', ''),
  ('Shiro', 350, 'Traditional Food', ''),
  ('Tegabino', 499, 'Traditional Food', ''),
  ('Quarter Roasted Chicken', 1800, 'Grill', 'Served with 1 side. Choose from fries, mashed potatoes, cooked vegetables or rice. Peri Peri sauce.'),
  ('Half Roasted Chicken', 3500, 'Grill', 'Served with 2 sides. Choose from fries, mashed potatoes, cooked vegetables or rice. Peri Peri sauce.'),
  ('Full Roasted Chicken', 6500, 'Grill', 'Served with 4 sides. Choose from fries, mashed potatoes, cooked vegetables or rice. Peri Peri sauce.'),
  ('Chicken Fettuccine', 1000, 'Pasta', 'In a creamy pink sauce.'),
  ('Bolognese', 600, 'Pasta', ''),
  ('Vegetable Pasta', 370, 'Pasta', ''),
  ('Tomato Pasta', 400, 'Pasta', ''),
  ('Arrabbiata', 400, 'Pasta', ''),
  ('Vegetable Noodles', 500, 'Pasta', ''),
  ('Beef Noodles', 750, 'Pasta', ''),
  ('Chicken Noodles', 800, 'Pasta', ''),
  ('Chicken Bowl', 1100, 'Bowls & Wings', 'Rice, avocado guacamole, tomato salad, chickpeas and Abol sauce.'),
  ('Beef Bowl', 899, 'Bowls & Wings', 'Rice, avocado guacamole, tomato salad, chickpeas and Abol sauce.'),
  ('Veggie Bowl', 499, 'Bowls & Wings', 'Rice, avocado guacamole, tomato salad, chickpeas and Abol sauce.'),
  ('Margherita Pizza', 699, 'Burgers & Pizza', ''),
  ('Beef Pizza', 879, 'Burgers & Pizza', ''),
  ('Tuna Pizza', 899, 'Burgers & Pizza', ''),
  ('Special Pizza', 1100, 'Burgers & Pizza', ''),
  ('Veggie Pizza', 499, 'Burgers & Pizza', ''),
  ('Chicken Pizza', 1000, 'Burgers & Pizza', ''),
  ('Turkish Pizza', 1000, 'Burgers & Pizza', ''),
  ('Abol Beef Burger', 620, 'Burgers & Pizza', ''),
  ('Abol Cheeseburger', 680, 'Burgers & Pizza', ''),
  ('Double Cheeseburger', 810, 'Burgers & Pizza', ''),
  ('Chicken Burger', 1100, 'Burgers & Pizza', ''),
  ('Falafel Burger', 400, 'Burgers & Pizza', ''),
  ('Chicken & Waffles', 1000, 'Sides', ''),
  ('Loaded Fries', 450, 'Sides', 'With Abol house sauces and melted cheese.'),
  ('Falafel with Chips', 400, 'Sides', ''),
  ('Mixed Salad', 350, 'Salads', ''),
  ('Tuna Salad', 600, 'Salads', ''),
  ('Chicken Salad', 900, 'Salads', '')
), target as (
 select r.id restaurant_id,c.id category_id,p.name,p.price,p.description
 from printed p join public.restaurants r on r.slug='abol-coffee'
 join public.categories c on c.restaurant_id=r.id and lower(c.name)=lower(p.category)
)
insert into public.menu_items (restaurant_id,category_id,name,price,description,sort_order,is_popular,is_available)
select t.restaurant_id,t.category_id,t.name,t.price,nullif(t.description,''),
 (select coalesce(max(m.sort_order),0) from public.menu_items m where m.restaurant_id=t.restaurant_id)
 + row_number() over (partition by t.restaurant_id order by t.category_id,t.name),
 false,true from target t
where not exists (select 1 from public.menu_items m where m.restaurant_id=t.restaurant_id and lower(m.name)=lower(t.name));

-- The following legacy pasta entries may be distinct products and are intentionally preserved.
-- Do not alter drinks, desserts, opening hours, branding, CSS or other restaurant data.
commit;

-- Post-run verification (read only):
-- select c.name, count(*) from public.menu_items m join public.categories c on c.id=m.category_id
-- join public.restaurants r on r.id=m.restaurant_id where r.slug='abol-coffee' group by c.name order by c.name;
