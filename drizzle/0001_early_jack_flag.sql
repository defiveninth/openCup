CREATE INDEX "events_restaurant_time_idx" ON "analytics_events" USING btree ("restaurant_id","created_at");--> statement-breakpoint
CREATE INDEX "events_menu_item_idx" ON "analytics_events" USING btree ("menu_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unconfirmed_participant_item_idx" ON "bucket_items" USING btree ("bucket_id","participant_id","menu_item_id") WHERE "bucket_items"."batch_id" is null;--> statement-breakpoint
CREATE INDEX "bucket_items_bucket_idx" ON "bucket_items" USING btree ("bucket_id");--> statement-breakpoint
CREATE INDEX "menu_restaurant_idx" ON "menu_items" USING btree ("restaurant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bucket_batch_number_idx" ON "order_batches" USING btree ("bucket_id","batch_number");--> statement-breakpoint
CREATE UNIQUE INDEX "restaurant_table_number_idx" ON "tables" USING btree ("restaurant_id","number");--> statement-breakpoint
ALTER TABLE "bucket_items" ADD CONSTRAINT "positive_quantity" CHECK ("bucket_items"."quantity">0);--> statement-breakpoint
ALTER TABLE "bucket_items" ADD CONSTRAINT "nonnegative_unit_price" CHECK ("bucket_items"."unit_price">=0);--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "nonnegative_price" CHECK ("menu_items"."price">=0);--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "nonnegative_cost_price" CHECK ("menu_items"."cost_price">=0);--> statement-breakpoint
ALTER TABLE "tables" ADD CONSTRAINT "positive_table_number" CHECK ("tables"."number">0);