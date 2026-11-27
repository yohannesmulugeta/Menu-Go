const stagingOrigin='https://admaki-menu-platform-staging.yohannesmulugeta084.workers.dev';
const productionOrigin='https://menu.admakidigital.com';
export const DEPLOYMENTS=Object.freeze({
 'admaki-menu-platform-staging':Object.freeze({label:'staging',publicOrigin:stagingOrigin,privateOrigins:[stagingOrigin]}),
 'admaki-menu-platform-production':Object.freeze({label:'production',publicOrigin:productionOrigin,privateOrigins:['https://app.admakidigital.com',productionOrigin,'https://admaki-menu-platform-production.yohannesmulugeta084.workers.dev']})
});
export function deployment(env){return DEPLOYMENTS[env?.ENVIRONMENT]||null;}
export function configuredDeployment(env){const value=deployment(env);if(!value)throw Object.assign(Error('Environment is not configured.'),{status:503});return value;}
