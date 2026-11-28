-- Synthetic fixtures only; no production identities, credentials or feedback.
INSERT INTO template_releases(template_id,version,name,supported_features_json) VALUES('classic',1,'Classic shared menu','[]');
INSERT INTO restaurants(id,name,slug,status) VALUES('staging-demo','ADMAKI staging example','staging-demo','draft');
INSERT INTO restaurant_configs(restaurant_id,template_id,template_version,features_json,theme_json) VALUES('staging-demo','classic',1,'{}','{"background":"#ffffff"}');
INSERT INTO config_presets(preset_id,version,name,schema_version,config_json) VALUES('cafe',1,'Café starter',1,'{"template_id":"classic","template_version":1,"features":{},"theme":{"background":"#ffffff"}}');

