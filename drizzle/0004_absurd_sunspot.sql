ALTER TABLE "categories" ADD COLUMN "name_kk" text;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "name_en" text;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "name_kk" text;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "name_en" text;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "description_kk" text;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "description_en" text;
--> statement-breakpoint
UPDATE "categories" SET name_en = name, name = 'Бургеры', name_kk = 'Бургерлер' WHERE name = 'Burgers' AND restaurant_id IN (SELECT id FROM restaurants WHERE slug = 'table-and-thyme');

--> statement-breakpoint
UPDATE "categories" SET name_en = name, name = 'Боулы и салаты', name_kk = 'Боулдар мен салаттар' WHERE name = 'Bowls & salads' AND restaurant_id IN (SELECT id FROM restaurants WHERE slug = 'table-and-thyme');

--> statement-breakpoint
UPDATE "categories" SET name_en = name, name = 'Закуски', name_kk = 'Тіскебасарлар' WHERE name = 'Small plates' AND restaurant_id IN (SELECT id FROM restaurants WHERE slug = 'table-and-thyme');

--> statement-breakpoint
UPDATE "categories" SET name_en = name, name = 'Напитки', name_kk = 'Сусындар' WHERE name = 'Drinks' AND restaurant_id IN (SELECT id FROM restaurants WHERE slug = 'table-and-thyme');

--> statement-breakpoint
UPDATE "categories" SET name_en = name, name = 'Десерты', name_kk = 'Десерттер' WHERE name = 'Desserts' AND restaurant_id IN (SELECT id FROM restaurants WHERE slug = 'table-and-thyme');

--> statement-breakpoint
UPDATE "menu_items" SET name_en = name, description_en = description, name = 'Бургер «Тайм»', name_kk = '«Тайм» бургері', description = 'Говядина на гриле, выдержанный чеддер, карамелизированный лук и фирменный соус с тимьяном.', description_kk = 'Грильдегі сиыр еті, чеддер, карамельденген пияз және тасшөп қосылған фирмалық тұздық.' WHERE name = 'The Thyme Burger' AND restaurant_id IN (SELECT id FROM restaurants WHERE slug = 'table-and-thyme');

--> statement-breakpoint
UPDATE "menu_items" SET name_en = name, description_en = description, name = 'Бургер с хрустящей курицей', name_kk = 'Қытырлақ тауық бургері', description = 'Курица в пахте, хрустящий коулслоу, огурчики и немного острого мёда.', description_kk = 'Айранға маринадталған тауық, қытырлақ қырыққабат салаты, тұздалған қияр және ащы бал.' WHERE name = 'Crispy Chicken Burger' AND restaurant_id IN (SELECT id FROM restaurants WHERE slug = 'table-and-thyme');

--> statement-breakpoint
UPDATE "menu_items" SET name_en = name, description_en = description, name = 'Овощной бургер', name_kk = 'Көкөніс бургері', description = 'Котлета из нута, авокадо, свежая зелень и майонез с травами.', description_kk = 'Ноқат котлеті, авокадо, балғын көк және шөп қосылған майонез.' WHERE name = 'The Garden Burger' AND restaurant_id IN (SELECT id FROM restaurants WHERE slug = 'table-and-thyme');

--> statement-breakpoint
UPDATE "menu_items" SET name_en = name, description_en = description, name = 'Зелёный боул', name_kk = 'Жасыл боул', description = 'Сезонная зелень, авокадо, огурец, киноа и зелёная заправка.', description_kk = 'Маусымдық көк, авокадо, қияр, киноа және жасыл тұздық.' WHERE name = 'Green Goddess Bowl' AND restaurant_id IN (SELECT id FROM restaurants WHERE slug = 'table-and-thyme');

--> statement-breakpoint
UPDATE "menu_items" SET name_en = name, description_en = description, name = 'Буррата с томатами', name_kk = 'Қызанақ қосылған буррата', description = 'Сливочная буррата, спелые томаты, базиликовое масло и хлеб на закваске.', description_kk = 'Кілегейлі буррата, піскен қызанақ, райхан майы және ашытқы наны.' WHERE name = 'Burrata & Tomatoes' AND restaurant_id IN (SELECT id FROM restaurants WHERE slug = 'table-and-thyme');

--> statement-breakpoint
UPDATE "menu_items" SET name_en = name, description_en = description, name = 'Боул с лососем', name_kk = 'Албырт боулы', description = 'Запечённый лосось, бурый рис, авокадо, эдамаме и цитрусовая заправка.', description_kk = 'Пісірілген албырт, қоңыр күріш, авокадо, эдамаме және цитрус тұздығы.' WHERE name = 'Salmon Harvest Bowl' AND restaurant_id IN (SELECT id FROM restaurants WHERE slug = 'table-and-thyme');

--> statement-breakpoint
UPDATE "menu_items" SET name_en = name, description_en = description, name = 'Картофель фри с трюфелем и пармезаном', name_kk = '', description = 'Золотистый картофель фри, трюфельное масло, пармезан и свежая петрушка.', description_kk = '' WHERE name = 'Truffle Parmesan Fries' AND restaurant_id IN (SELECT id FROM restaurants WHERE slug = 'table-and-thyme');

--> statement-breakpoint
UPDATE "menu_items" SET name_en = name, description_en = description, name = 'Хрустящие кальмары', name_kk = '', description = 'Нежные кальмары, лимон, морская соль и чесночный айоли.', description_kk = '' WHERE name = 'Crispy Calamari' AND restaurant_id IN (SELECT id FROM restaurants WHERE slug = 'table-and-thyme');

--> statement-breakpoint
UPDATE "menu_items" SET name_en = name, description_en = description, name = 'Матча латте', name_kk = 'Матча латте', description = 'Церемониальная матча, овсяное молоко и лёгкая ванильная пена. Со льдом.', description_kk = 'Салтанатты матча, сұлы сүті және жеңіл ваниль көбігі. Мұзбен беріледі.' WHERE name = 'Matcha Cloud' AND restaurant_id IN (SELECT id FROM restaurants WHERE slug = 'table-and-thyme');

--> statement-breakpoint
UPDATE "menu_items" SET name_en = name, description_en = description, name = 'Домашний лимонад', name_kk = 'Үй лимонады', description = 'Свежие лимоны, розмарин, немного мёда и газированная вода.', description_kk = 'Балғын лимон, гүлшетен, аздап бал және газдалған су.' WHERE name = 'House Lemonade' AND restaurant_id IN (SELECT id FROM restaurants WHERE slug = 'table-and-thyme');

--> statement-breakpoint
UPDATE "menu_items" SET name_en = name, description_en = description, name = 'Баскский чизкейк', name_kk = '', description = 'Карамельная корочка и нежная сливочная начинка. С ягодным соусом.', description_kk = '' WHERE name = 'Basque Cheesecake' AND restaurant_id IN (SELECT id FROM restaurants WHERE slug = 'table-and-thyme');

--> statement-breakpoint
UPDATE "menu_items" SET name_en = name, description_en = description, name = 'Шоколадный брауни', name_kk = '', description = 'Тёплый брауни из тёмного шоколада, ванильное мороженое и морская соль.', description_kk = '' WHERE name = 'Chocolate Brownie' AND restaurant_id IN (SELECT id FROM restaurants WHERE slug = 'table-and-thyme');
