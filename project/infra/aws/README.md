# AWS Terraform Deployment

Terraform configuration in this directory provisions the AWS infrastructure required to run the DDMS Fastify API and the Next.js web client on ECS Fargate while sourcing its database from Supabase.

## What Gets Created
- VPC with two public subnets and internet gateway.
- Application Load Balancer listening on HTTP port 80 with path-based routing (`/api/*` to the API service, everything else to the web UI).
- ECS cluster + two Fargate services (API and web).
- Two ECR repositories for pushing API and web container images.
- CloudWatch log groups for container logs.
- AWS Secrets Manager secret that stores the Supabase `DATABASE_URL` connection string.

> HTTPS is not enabled by default. After provisioning you can attach an ACM certificate and additional listener as needed.

## Prerequisites
- Terraform `>= 1.5`
- AWS CLI configured with credentials authorized to manage VPC, ECS, ECR, IAM, and Secrets Manager.
- Docker installed locally for building the application image.
- An existing Supabase project and its connection string (look for the `Connection string` section in the Supabase dashboard).

## Usage

1. **Prepare variables**
   ```bash
   cd infra/aws
   cp terraform.tfvars.example terraform.tfvars
   # Edit terraform.tfvars with your project name, environment, AWS region, and Supabase DATABASE_URL
   ```

2. **Initialize Terraform**
   ```bash
   terraform init
   ```

3. **Review and apply**
   ```bash
   terraform plan
   terraform apply
   ```
   On success Terraform prints the ALB DNS name (`alb_dns_name`) you can hit to reach the API.

4. **Build & push the containers**
   ```bash
   # From the repository root
   ./tools/deploy/build-and-push.sh <aws_region> <api_ecr_repository_url> <web_ecr_repository_url> [tag]
   ```
   Replace `<aws_region>`, `<api_ecr_repository_url>`, and `<web_ecr_repository_url>` with values from Terraform outputs (tags default to `latest`).

5. **Deploy the new images**
   The ECS services track the `latest` tag by default. After pushing new images run:
   ```bash
   ./tools/deploy/rollout.sh <aws_region> <ecs_cluster_name> <ecs_service_name> <web_ecs_service_name>
   ```

## Supabase Integration Notes
- Terraform stores the Supabase connection string as JSON (`{"DATABASE_URL": "...connection..."}`) in Secrets Manager.
- The API ECS task injects the `DATABASE_URL` environment variable from that secret and exposes `PORT=3001` and `HOST=0.0.0.0`.
- The web ECS task receives `NEXT_PUBLIC_API_BASE_URL` pointing at the ALB (e.g. `http://<alb_dns_name>/api/v1`) plus the development tenant/JWT helpers so browser requests are forwarded to the API automatically.
- Update your Supabase project's allowed IPs (if enabled) to include the AWS load balancer or VPC CIDR ranges.

## Clean Up
To destroy all AWS resources created by this configuration (excluding the pushed container images):
```bash
terraform destroy
```
Do **not** forget to manually remove images from the ECR repository if you no longer need them.
