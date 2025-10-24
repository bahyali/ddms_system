data "aws_caller_identity" "current" {}

data "aws_partition" "current" {}

data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  name_prefix = "${var.project_name}-${var.environment}"

  supabase_secret_name = length(trimspace(var.supabase_db_secret_name)) > 0 ? var.supabase_db_secret_name : "${local.name_prefix}-supabase-db-url"

  azs = slice(data.aws_availability_zones.available.names, 0, length(var.public_subnet_cidrs))

  public_subnet_map = {
    for idx, cidr in var.public_subnet_cidrs :
    idx => {
      cidr = cidr
      az   = local.azs[idx]
    }
  }
}

resource "aws_vpc" "main" {
  cidr_block                       = var.vpc_cidr
  assign_generated_ipv6_cidr_block = true
  enable_dns_support               = true
  enable_dns_hostnames             = true

  tags = {
    Name        = "${local.name_prefix}-vpc"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name        = "${local.name_prefix}-igw"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_subnet" "public" {
  for_each          = local.public_subnet_map
  vpc_id            = aws_vpc.main.id
  cidr_block        = each.value.cidr
  availability_zone = each.value.az
  ipv6_cidr_block   = cidrsubnet(aws_vpc.main.ipv6_cidr_block, 8, each.key)

  map_public_ip_on_launch         = true
  assign_ipv6_address_on_creation = true

  tags = {
    Name        = "${local.name_prefix}-public-${each.value.az}"
    Environment = var.environment
    Project     = var.project_name
    Tier        = "public"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name        = "${local.name_prefix}-public-rt"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_route" "public_internet_access" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.igw.id
}

resource "aws_route" "public_internet_access_ipv6" {
  route_table_id              = aws_route_table.public.id
  destination_ipv6_cidr_block = "::/0"
  gateway_id                  = aws_internet_gateway.igw.id
}

resource "aws_route_table_association" "public" {
  for_each       = aws_subnet.public
  subnet_id      = each.value.id
  route_table_id = aws_route_table.public.id
}

resource "aws_security_group" "alb" {
  name        = "${local.name_prefix}-alb"
  description = "Allow HTTP access to the Application Load Balancer"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port        = 80
    to_port          = 80
    protocol         = "tcp"
    cidr_blocks      = ["0.0.0.0/0"]
    ipv6_cidr_blocks = ["::/0"]
  }

  tags = {
    Name        = "${local.name_prefix}-alb-sg"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_security_group" "service" {
  name        = "${local.name_prefix}-service"
  description = "Allow ALB to reach ECS tasks"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name        = "${local.name_prefix}-service-sg"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_security_group_rule" "service_ingress_from_alb" {
  type                     = "ingress"
  from_port                = var.container_port
  to_port                  = var.container_port
  protocol                 = "tcp"
  security_group_id        = aws_security_group.service.id
  source_security_group_id = aws_security_group.alb.id
  description              = "Allow traffic from ALB"
}

resource "aws_security_group" "web" {
  name        = "${local.name_prefix}-web"
  description = "Allow ALB to reach the Next.js web tasks"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name        = "${local.name_prefix}-web-sg"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_security_group_rule" "web_ingress_from_alb" {
  type                     = "ingress"
  from_port                = var.web_container_port
  to_port                  = var.web_container_port
  protocol                 = "tcp"
  security_group_id        = aws_security_group.web.id
  source_security_group_id = aws_security_group.alb.id
  description              = "Allow ALB traffic to the web service"
}

resource "aws_lb" "api" {
  name               = "${local.name_prefix}-alb"
  internal           = false
  load_balancer_type = "application"
  ip_address_type    = "dualstack"
  security_groups    = [aws_security_group.alb.id]
  subnets            = [for subnet in aws_subnet.public : subnet.id]

  tags = {
    Name        = "${local.name_prefix}-alb"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_lb_target_group" "api" {
  name        = "${local.name_prefix}-api-tg"
  port        = var.container_port
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = aws_vpc.main.id

  health_check {
    path                = var.health_check_path
    matcher             = "200-399"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = {
    Name        = "${local.name_prefix}-api-tg"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_lb_target_group" "web" {
  name        = "${local.name_prefix}-web-tg"
  port        = var.web_container_port
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = aws_vpc.main.id

  health_check {
    path                = var.web_health_check_path
    matcher             = "200-399"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = {
    Name        = "${local.name_prefix}-web-tg"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.api.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web.arn
  }
}

resource "aws_lb_listener_rule" "api_path" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }

  condition {
    path_pattern {
      values = ["/api/*"]
    }
  }
}

resource "aws_ecr_repository" "api" {
  name                 = "${var.project_name}-api"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_ecr_repository" "web" {
  name                 = "${var.project_name}-web"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${local.name_prefix}-api"
  retention_in_days = var.log_retention_in_days
}

resource "aws_cloudwatch_log_group" "web" {
  name              = "/ecs/${local.name_prefix}-web"
  retention_in_days = var.log_retention_in_days
}

resource "aws_secretsmanager_secret" "supabase_db_url" {
  name                    = local.supabase_secret_name
  description             = "Supabase connection string for ${local.name_prefix}"
  recovery_window_in_days = 0

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_secretsmanager_secret_version" "supabase_db_url" {
  secret_id     = aws_secretsmanager_secret.supabase_db_url.id
  secret_string = jsonencode({ DATABASE_URL = var.supabase_db_url })
}

resource "aws_iam_role" "ecs_task_execution" {
  name = "${local.name_prefix}-task-exec"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action = "sts:AssumeRole",
        Effect = "Allow",
        Principal = {
          Service = "ecs-tasks.${data.aws_partition.current.dns_suffix}"
        }
      }
    ]
  })
}

resource "aws_iam_role" "ecs_task" {
  name = "${local.name_prefix}-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action = "sts:AssumeRole",
        Effect = "Allow",
        Principal = {
          Service = "ecs-tasks.${data.aws_partition.current.dns_suffix}"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_default" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:${data.aws_partition.current.partition}:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_policy" "secretsmanager_access" {
  name        = "${local.name_prefix}-secrets-access"
  description = "Allow ECS tasks to read Supabase secret"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect   = "Allow",
        Action   = ["secretsmanager:GetSecretValue"],
        Resource = aws_secretsmanager_secret.supabase_db_url.arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_secret_access" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = aws_iam_policy.secretsmanager_access.arn
}

resource "aws_ecs_cluster" "main" {
  name = "${local.name_prefix}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

locals {
  api_container_image = "${aws_ecr_repository.api.repository_url}:${var.container_image_tag}"
  web_container_image = "${aws_ecr_repository.web.repository_url}:${var.web_container_image_tag}"
  web_api_path        = startswith(var.web_next_public_api_base_path, "/") ? var.web_next_public_api_base_path : "/${var.web_next_public_api_base_path}"
  web_api_base_url    = "http://${aws_lb.api.dns_name}${local.web_api_path}"
}

resource "aws_ecs_task_definition" "api" {
  family                   = "${local.name_prefix}-api"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.container_cpu
  memory                   = var.container_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "api"
      image     = local.api_container_image
      essential = true
      portMappings = [
        {
          containerPort = var.container_port
          hostPort      = var.container_port
          protocol      = "tcp"
        }
      ]
      environment = [
        {
          name  = "NODE_ENV"
          value = "production"
        },
        {
          name  = "HOST"
          value = "0.0.0.0"
        },
        {
          name  = "PORT"
          value = tostring(var.container_port)
        }
      ]
      secrets = [
        {
          name      = "DATABASE_URL"
          valueFrom = "${aws_secretsmanager_secret.supabase_db_url.arn}:DATABASE_URL::"
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.api.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }
      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:${var.container_port}${var.health_check_path} || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 10
      }
    }
  ])
}

resource "aws_ecs_task_definition" "web" {
  family                   = "${local.name_prefix}-web"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.web_container_cpu
  memory                   = var.web_container_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "web"
      image     = local.web_container_image
      essential = true
      portMappings = [
        {
          containerPort = var.web_container_port
          hostPort      = var.web_container_port
          protocol      = "tcp"
        }
      ]
      environment = [
        {
          name  = "NODE_ENV"
          value = "production"
        },
        {
          name  = "PORT"
          value = tostring(var.web_container_port)
        },
        {
          name  = "HOST"
          value = "0.0.0.0"
        },
        {
          name  = "NEXT_PUBLIC_API_BASE_URL"
          value = local.web_api_base_url
        },
        {
          name  = "NEXT_PUBLIC_TENANT_ID"
          value = var.web_next_public_tenant_id
        },
        {
          name  = "NEXT_PUBLIC_DEV_JWT"
          value = var.web_next_public_dev_jwt
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.web.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }
      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:${var.web_container_port}${var.web_health_check_path} || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 10
      }
    }
  ])
}

resource "aws_ecs_service" "api" {
  name            = "${local.name_prefix}-api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"
  platform_version = "LATEST"

  network_configuration {
    subnets          = [for subnet in aws_subnet.public : subnet.id]
    security_groups  = [aws_security_group.service.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = var.container_port
  }

  deployment_minimum_healthy_percent = 50
  deployment_maximum_percent         = 200

  enable_execute_command = true

  depends_on = [
    aws_lb_listener.http,
    aws_lb_target_group.api,
    aws_lb_listener_rule.api_path
  ]

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_ecs_service" "web" {
  name            = "${local.name_prefix}-web"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.web.arn
  desired_count   = var.web_desired_count
  launch_type     = "FARGATE"
  platform_version = "LATEST"

  network_configuration {
    subnets          = [for subnet in aws_subnet.public : subnet.id]
    security_groups  = [aws_security_group.web.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.web.arn
    container_name   = "web"
    container_port   = var.web_container_port
  }

  deployment_minimum_healthy_percent = 50
  deployment_maximum_percent         = 200

  enable_execute_command = true

  depends_on = [
    aws_lb_listener.http,
    aws_lb_target_group.web
  ]

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}
