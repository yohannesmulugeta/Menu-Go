import {policyFromRows} from '../config/service.mjs';
import {fail} from '../auth/http.mjs';

export async function publishedContext(db,slug,templateSource='config') {
  const paths=templateSource==='capabilities'
    ?['$.capabilities.template_id','$.capabilities.template_version']
    :['$.config.template_id','$.config.template_version'];
  // One read keeps the snapshot, template and current policies coherent.
  const row=await db.prepare(`SELECT r.id,r.status,h.revision,p.snapshot_json,t.supported_features_json,
    (SELECT json_group_array(json_object(
      'feature_key',f.feature_key,'allowed',f.allowed,'manager_editable',f.manager_editable,
      'forced_value',f.forced_value,'revision',f.revision,'policy_revision',s.revision))
      FROM feature_policies f) policy_json
    FROM restaurants r
    JOIN restaurant_publication_heads h ON h.restaurant_id=r.id
    JOIN restaurant_publications p ON p.restaurant_id=h.restaurant_id AND p.revision=h.revision
    LEFT JOIN platform_policy_state s ON s.singleton=1
    LEFT JOIN template_releases t ON t.template_id=json_extract(p.snapshot_json,?)
      AND t.version=json_extract(p.snapshot_json,?)
    WHERE r.slug=? AND r.status='active'`).bind(...paths,slug).first();
  if(!row)fail(404,'Menu not found.');
  return {
    restaurant_id:row.id,revision:row.revision,snapshot:JSON.parse(row.snapshot_json),
    policy:policyFromRows(JSON.parse(row.policy_json)),
    supported:row.supported_features_json===null?null:JSON.parse(row.supported_features_json)
  };
}

