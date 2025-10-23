import { INestApplication } from '@nestjs/common';
import { ApiDocumentationHub } from './app.doc';
import { ArchitectureDocumentation } from './standard/architecture.doc';
import { SecurityDocumentation } from './standard/security.doc';
import { StandardsDocumentation } from './standard/standards.doc';
import { GettingStartedDocumentation } from './standard/getting-started.doc';
import { TerminologyDocumentation } from './standard/terminology.doc';
import { OverviewPostgreSQLDocumentation } from './standard/overview-postgresql.doc';
import { OverviewRedisDocumentation } from './standard/overview-redis.doc';
import { OverviewEventStoreDBDocumentation } from './standard/overview-eventstore.doc';
import { OverviewKafkaDocumentation } from './standard/overview-kafka.doc';
import { SystemOperationsDocumentation } from './standard/system-operations.doc';
import { AppConfigUtil } from 'src/shared/config/app-config.util';
/**
 * Setup standard Swagger documentation using modular documentation classes
 */
export function setupStandardSwaggerDocs(
  app: INestApplication,
  port: string | number,
): Record<string, string> {
  if (AppConfigUtil.isProduction()) {
    return {};
  }

  // Setup consolidated documentation modules (groups multiple domains)
  SystemOperationsDocumentation.setup(app, port);
  ApiDocumentationHub.setup(app, port);
  ArchitectureDocumentation.setup(app, port);
  SecurityDocumentation.setup(app, port);
  StandardsDocumentation.setup(app, port);
  TerminologyDocumentation.setup(app, port);
  GettingStartedDocumentation.setup(app, port);
  OverviewPostgreSQLDocumentation.setup(app, port);
  OverviewRedisDocumentation.setup(app, port);
  OverviewEventStoreDBDocumentation.setup(app, port);
  OverviewKafkaDocumentation.setup(app, port);

  return {
    hub: ApiDocumentationHub.getEndpoint(port),
    system: SystemOperationsDocumentation.getEndpoint(port),
    architecture: ArchitectureDocumentation.getEndpoint(port),
    security: SecurityDocumentation.getEndpoint(port),
    standards: StandardsDocumentation.getEndpoint(port),
    terminology: TerminologyDocumentation.getEndpoint(port),
    gettingStarted: GettingStartedDocumentation.getEndpoint(port),
  };
}
