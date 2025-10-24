output "alb_dns_name" {
  description = "DNS name of the public Application Load Balancer exposing the web app and API."
  value       = aws_lb.api.dns_name
}

output "alb_zone_id" {
  description = "Hosted zone ID for the ALB (useful for Route53 records)."
  value       = aws_lb.api.zone_id
}

output "ecs_cluster_name" {
  description = "Name of the ECS cluster running the API service."
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "ECS service name for the Fastify API."
  value       = aws_ecs_service.api.name
}

output "ecr_repository_url" {
  description = "URL of the ECR repository to push API container images."
  value       = aws_ecr_repository.api.repository_url
}

output "web_ecs_service_name" {
  description = "ECS service name for the Next.js web application."
  value       = aws_ecs_service.web.name
}

output "web_ecr_repository_url" {
  description = "URL of the ECR repository to push web application container images."
  value       = aws_ecr_repository.web.repository_url
}

output "supabase_secret_arn" {
  description = "ARN of the Secrets Manager secret containing the Supabase connection string."
  value       = aws_secretsmanager_secret.supabase_db_url.arn
  sensitive   = true
}
