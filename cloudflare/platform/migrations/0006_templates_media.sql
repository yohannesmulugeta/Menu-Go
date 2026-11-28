-- Additive staging migration. Prior migrations and published snapshots stay intact.
ALTER TABLE media_assets ADD COLUMN lifecycle TEXT NOT NULL DEFAULT 'ready' CHECK(lifecycle IN ('pending','ready','deleting'));
CREATE INDEX media_cleanup_candidates ON media_assets(lifecycle,state,created_at,id);
CREATE TABLE media_item_owners(
 media_id TEXT PRIMARY KEY, restaurant_id TEXT NOT NULL, menu_item_id TEXT NOT NULL,
 FOREIGN KEY(media_id,restaurant_id) REFERENCES media_assets(id,restaurant_id),
 FOREIGN KEY(menu_item_id,restaurant_id) REFERENCES menu_items(id,restaurant_id)
);
CREATE TABLE media_draft_refs(
 restaurant_id TEXT NOT NULL REFERENCES restaurants(id), slot TEXT NOT NULL, media_id TEXT NOT NULL,
 PRIMARY KEY(restaurant_id,slot),
 FOREIGN KEY(media_id,restaurant_id) REFERENCES media_assets(id,restaurant_id)
);
CREATE INDEX media_draft_asset ON media_draft_refs(media_id);
CREATE TABLE media_publication_refs(
 restaurant_id TEXT NOT NULL, publication_revision INTEGER NOT NULL, media_id TEXT NOT NULL,
 PRIMARY KEY(restaurant_id,publication_revision,media_id),
 FOREIGN KEY(restaurant_id,publication_revision) REFERENCES restaurant_publications(restaurant_id,revision),
 FOREIGN KEY(media_id,restaurant_id) REFERENCES media_assets(id,restaurant_id)
);
CREATE INDEX media_publication_asset ON media_publication_refs(media_id);
-- Every release consumes the same feature catalogue. No restaurant is switched.
INSERT INTO template_releases(template_id,version,name,supported_features_json)
 SELECT 'abol',1,'Abol · photo cards',supported_features_json FROM template_releases WHERE template_id='classic' AND version=2;
INSERT INTO template_releases(template_id,version,name,supported_features_json)
 SELECT 'mokodo',1,'Mokodo · bold menu',supported_features_json FROM template_releases WHERE template_id='classic' AND version=2;
INSERT INTO template_releases(template_id,version,name,supported_features_json)
 SELECT 'sheba',1,'Sheba · editorial menu',supported_features_json FROM template_releases WHERE template_id='classic' AND version=2;
INSERT INTO template_releases(template_id,version,name,supported_features_json)
 SELECT 'occasion',1,'Occasion · white café menu',supported_features_json FROM template_releases WHERE template_id='classic' AND version=2;
