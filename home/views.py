from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.utils import timezone
from datetime import datetime, date
from projects.models import Project
from tasks.models import Task
from django.contrib.auth.models import User
from django.contrib import messages
from django.db.models import Q
from .forms import TaskForm, ProjectForm, InviteForm

# Landing page (public)
def landing(request):
    template_data = {'title': 'Get Started | SwyftTask'}
    return render(request, 'home/landing_page.html', {'template_data': template_data})

from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.utils import timezone
from datetime import datetime, date
from projects.models import Project
from tasks.models import Task
from django.contrib.auth.models import User
from django.contrib import messages
from django.db.models import Q
import json
from django.core.serializers.json import DjangoJSONEncoder

# home/views.py - Update the dashboard view function
@login_required
def dashboard(request):
    # Get user's projects and tasks
    deleted_count = cleanup_user_projects(request.user)
    if deleted_count > 0:
        print(f"🧹 Cleaned up {deleted_count} duplicate projects")
    
    # Now get unique projects
    unique_projects = Project.objects.filter(
        Q(owner=request.user) | Q(members=request.user)
    ).order_by('name', '-created_at')
    
    # Use Python to ensure uniqueness
    projects = []
    seen_names = set()
    
    for project in unique_projects:
        if project.name not in seen_names:
            seen_names.add(project.name)
            projects.append(project)
    
    # Use projects list for the rest of your code
    all_tasks = Task.objects.filter(project__in=projects)
    
    # Calculate counts - USE len() FOR LISTS, NOT count()
    active_projects_count = len(projects)  # Changed from projects.count()
    tasks_due_count = all_tasks.exclude(status='done').count()
    overdue_count = all_tasks.filter(
        due_date__lt=timezone.now().date(), 
        status__in=['todo', 'inprogress', 'review']
    ).count()
    
    # Fix team_count - need to extract IDs from the projects list
    project_ids = [project.id for project in projects]
    team_count = User.objects.filter(
        Q(project_owner__id__in=project_ids) | 
        Q(project_member__id__in=project_ids)
    ).distinct().count()
    
    # Get today's date
    today = timezone.now().date()
    
    # Tasks due today
    tasks_due_today = all_tasks.filter(
        due_date=today,
        status__in=['todo', 'inprogress', 'review']
    )[:5]
    
    # Categorize tasks for Kanban board
    todo_tasks = all_tasks.filter(status='todo')[:5]
    inprogress_tasks = all_tasks.filter(status='inprogress')[:5]
    # If inprogress is empty, check for other possible status values
    if inprogress_tasks.count() == 0:
        # Check for 'pending' or 'in_progress'
        inprogress_tasks = all_tasks.filter(
            Q(status='inprogress') | 
            Q(status='pending') | 
            Q(status='in_progress')
        )[:5]
    review_tasks = all_tasks.filter(status='review')[:5]
    done_tasks = all_tasks.filter(status='done')[:5]
    
    # Your assigned tasks
    your_tasks = all_tasks.filter(assigned_to=request.user).exclude(status='done').order_by('-due_date')[:5]
    
    # Recent activity
    recent_activity = all_tasks.order_by('-created_at')[:5]
    
    # Calculate progress for each project WITH TASK COUNT
    projects_with_stats = []
    for project in projects[:4]:  # Show up to 4 projects in pinned section
        total_tasks = Task.objects.filter(project=project).count()
        completed_tasks = Task.objects.filter(project=project, status='done').count()
        
        if total_tasks > 0:
            progress = int((completed_tasks / total_tasks) * 100)
        else:
            progress = 0
        
        # Add progress and CSS class based on progress
        project.progress = progress
        project.task_count = total_tasks  # Add task count to project object
        if progress < 50:
            project.css_class = 'urgent'
        elif progress < 90:
            project.css_class = 'warning'
        else:
            project.css_class = ''
        projects_with_stats.append(project)
    
    # Team members (limit to 4 for display) - use project_ids
    team_members = User.objects.filter(
        Q(project_owner__id__in=project_ids) | 
        Q(project_member__id__in=project_ids)
    ).distinct()[:4]
    
    # Format today's date for display
    today_formatted = datetime.now().strftime("%A, %d %B %Y")
    
    # Prepare task data for JSON serialization
    def format_task(task):
        return {
            'id': task.id,
            'title': task.title,
            'status': task.status,
            'status_display': task.get_status_display(),
            'project_name': task.project.name,
            'assigned_to': task.assigned_to.username if task.assigned_to else None,
            'assigned_to_name': task.assigned_to.get_full_name() if task.assigned_to else 'Unassigned',
            'due_date': task.due_date.strftime('%Y-%m-%d') if task.due_date else None,
            'due_date_display': task.due_date.strftime('%b %d') if task.due_date else 'No deadline',
            'created_at': task.created_at.strftime('%Y-%m-%d %H:%M'),
            'description': task.description or 'No description',
        }
    
    # Prepare JSON data for JavaScript
    todos_json = [format_task(task) for task in all_tasks.filter(status='todo')[:10]]
    inprogress_json = [format_task(task) for task in all_tasks.filter(status='inprogress')[:10]]
    review_json = [format_task(task) for task in all_tasks.filter(status='review')[:10]]
    done_json = [format_task(task) for task in all_tasks.filter(status='done')[:10]]
    all_tasks_json = [format_task(task) for task in all_tasks[:50]]
    
    # Get total project count for the "View All" button - USE len()
    total_projects_count = len(projects)  # Changed from projects.count()
    
    context = {
        # Basic counts
        'active_projects_count': active_projects_count,
        'tasks_due_count': tasks_due_count,
        'overdue_count': overdue_count,
        'team_count': team_count,
        'total_projects_count': total_projects_count,
        
        # User info
        'user': request.user,
        'user_first_name': request.user.first_name or request.user.username,
        'today_formatted': today_formatted,
        'today': today,
        
        # Tasks for dashboard sections
        'todo_tasks': todo_tasks,
        'inprogress_tasks': inprogress_tasks,
        'review_tasks': review_tasks,
        'done_tasks': done_tasks,
        'tasks_due_today': tasks_due_today,
        'your_tasks': your_tasks,
        'recent_activity': recent_activity,
        
        # Projects
        'projects': projects_with_stats,
        'all_projects': projects,  # This is now a list, not QuerySet
        'team_members': team_members,
        
        # JSON data for JavaScript
        'todos_json': json.dumps(todos_json, cls=DjangoJSONEncoder),
        'inprogress_json': json.dumps(inprogress_json, cls=DjangoJSONEncoder),
        'review_json': json.dumps(review_json, cls=DjangoJSONEncoder),
        'done_json': json.dumps(done_json, cls=DjangoJSONEncoder),
        'all_tasks_json': json.dumps(all_tasks_json, cls=DjangoJSONEncoder),
    }
    
    return render(request, 'home/dashboard.html', context)

from django.db import transaction
from django.db.models import Count

def cleanup_user_projects(user):
    """Remove duplicate projects for a user"""
    # Get all projects owned by the user
    user_projects = Project.objects.filter(owner=user)
    
    # Find duplicate names
    duplicate_names = user_projects.values('name').annotate(
        count=Count('id')
    ).filter(count__gt=1)
    
    deleted_count = 0
    
    for duplicate in duplicate_names:
        # Get all projects with this name (oldest first)
        projects_with_name = user_projects.filter(
            name=duplicate['name']
        ).order_by('created_at')
        
        # Keep the newest one (last in sorted order), delete the rest
        for i, project in enumerate(projects_with_name):
            if i < len(projects_with_name) - 1:  # Not the last one (newest)
                project.delete()
                deleted_count += 1
    
    return deleted_count

# home/views.py - add these imports and view
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
import json
from tasks.models import Task
from projects.models import Project
from django.contrib.auth.models import User

@csrf_exempt
@require_POST
@login_required
def create_task_api(request):
    try:
        data = json.loads(request.body.decode('utf-8'))
        
        # Validate required fields
        if not data.get('title'):
            return JsonResponse({'success': False, 'error': 'Title is required'}, status=400)
        
        if not data.get('project'):
            return JsonResponse({'success': False, 'error': 'Project is required'}, status=400)
        
        # Get project
        try:
            project = Project.objects.get(id=data['project'])
        except Project.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Project not found'}, status=404)
        
        # Check if user has access to this project
        if project.owner != request.user and request.user not in project.members.all():
            return JsonResponse({'success': False, 'error': 'You do not have access to this project'}, status=403)
        
        # Get assigned user if specified
        assigned_to = None
        if data.get('assigned_to'):
            try:
                assigned_to = User.objects.get(id=data['assigned_to'])
            except User.DoesNotExist:
                return JsonResponse({'success': False, 'error': 'Assigned user not found'}, status=404)
        
        # Parse due date
        due_date = None
        if data.get('due_date'):
            try:
                due_date = datetime.strptime(data['due_date'], '%Y-%m-%d').date()
            except ValueError:
                return JsonResponse({'success': False, 'error': 'Invalid date format'}, status=400)
        
        # Create task
        task = Task(
            title=data['title'],
            description=data.get('description', ''),
            project=project,
            assigned_to=assigned_to,
            status=data.get('status', 'todo'),
            priority=data.get('priority', 'medium'),
            due_date=due_date
        )
        
        task.save()
        
        # Return success response with task data
        return JsonResponse({
            'success': True,
            'message': 'Task created successfully!',
            'task': {
                'id': task.id,
                'title': task.title,
                'status': task.status,
                'project_id': task.project.id,
                'project_name': task.project.name,
                'assigned_to': task.assigned_to.id if task.assigned_to else None,
                'assigned_to_name': task.assigned_to.get_full_name() if task.assigned_to else None,
                'due_date': task.due_date.strftime('%Y-%m-%d') if task.due_date else None,
                'created_at': task.created_at.strftime('%Y-%m-%d %H:%M:%S')
            }
        })
        
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

from django.utils import timezone
from datetime import datetime
from django.core.exceptions import PermissionDenied

# home/views.py - Update create_project_api function

@csrf_exempt
@require_POST
@login_required
def create_project_api(request):
    try:
        data = json.loads(request.body.decode('utf-8'))
        
        # Validate required fields
        if not data.get('name'):
            return JsonResponse({'success': False, 'error': 'Project name is required'}, status=400)
        
        if len(data['name']) > 255:
            return JsonResponse({'success': False, 'error': 'Project name is too long (max 255 characters)'}, status=400)
        
        # ⭐⭐ CRITICAL: Check for duplicate project name for this user ⭐⭐
        project_name = data['name'].strip()
        
        # Check if user already has a project with this name
        existing_project = Project.objects.filter(
            name__iexact=project_name,  # Case-insensitive match
            owner=request.user
        ).first()
        
        if existing_project:
            # Check if it was created recently (within last 5 minutes)
            from django.utils.timezone import now
            from datetime import timedelta
            
            recent_threshold = now() - timedelta(minutes=5)
            is_recent = existing_project.created_at > recent_threshold
            
            error_msg = f'You already have a project named "{project_name}"'
            if is_recent:
                error_msg += ' (created recently)'
            
            return JsonResponse({
                'success': False, 
                'error': error_msg,
                'duplicate_project_id': existing_project.id,
                'duplicate_project_name': existing_project.name,
                'created_at': existing_project.created_at.strftime('%Y-%m-%d %H:%M'),
                'suggested_action': 'rename' if is_recent else 'use_existing'
            }, status=400)
        
        # Create project
        project = Project(
            name=project_name,
            description=data.get('description', '').strip(),
            owner=request.user
        )
        
        project.save()
        
        # Add owner as member
        project.members.add(request.user)
        
        # Add invited members if provided
        invited_emails = data.get('invited_emails', [])
        if invited_emails:
            existing_users = User.objects.filter(email__in=invited_emails)
            for user in existing_users:
                if user != request.user:
                    project.members.add(user)
        
        return JsonResponse({
            'success': True,
            'message': 'Project created successfully!',
            'project': {
                'id': project.id,
                'name': project.name,
                'description': project.description,
                'owner_id': project.owner.id,
                'owner_name': project.owner.get_full_name() or project.owner.username,
                'created_at': project.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                'member_count': project.members.count()
            }
        })
        
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)
    
# home/views.py - Update project_details function
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET
import json

@require_GET  # Only allow GET requests
@login_required
def project_details(request, project_id):
    try:
        project = get_object_or_404(Project, id=project_id)
        
        # Check if user has access to this project
        if project.owner != request.user and request.user not in project.members.all():
            return JsonResponse({
                'success': False, 
                'error': 'Access denied'
            }, status=403)
        
        # Get all tasks for this project
        tasks = Task.objects.filter(project=project)

        # PROPERLY categorize tasks by status
        # First, get all possible status values from the database
        all_statuses = tasks.values_list('status', flat=True).distinct()
        print(f"🔍 Found status values in DB: {list(all_statuses)}")
        
        # Map status values to our categories
        def get_tasks_by_status(status_list):
            return tasks.filter(status__in=status_list)
        
        # Define status mappings
        status_mapping = {
            'todo': ['todo', 'Todo', 'To Do', 'TO_DO'],
            'inprogress': ['inprogress', 'In Progress', 'in_progress', 'pending', 'Pending'],
            'review': ['review', 'Review'],
            'done': ['done', 'Done', 'Completed', 'completed']
        }
        
        # Get tasks for each category
        tasks_by_status = {}
        for category, status_values in status_mapping.items():
            category_tasks = tasks.filter(status__in=status_values)
            tasks_by_status[category] = [format_task_for_kanban(task) for task in category_tasks]
            print(f"📊 {category}: {category_tasks.count()} tasks")
        
        # Calculate statistics
        total_tasks = tasks.count()
        completed_tasks = tasks.filter(status='done').count()
        overdue_tasks = tasks.filter(
            due_date__lt=timezone.now().date(),
            status__in=['todo', 'inprogress', 'review']
        ).count()

        # print(f"📊 Stats - Total: {total_tasks}, Completed: {completed_tasks}, Overdue: {overdue_tasks}")
        
        progress = int((completed_tasks / total_tasks * 100)) if total_tasks > 0 else 0
        
        # Get team members
        team_members = project.members.all()
        
        # Get recent activity (last 10 tasks created/updated)
        recent_activity = tasks.order_by('-updated_at')[:10]
        
        # Prepare task data for kanban
        def format_task_for_kanban(task):
            return {
                'id': task.id,
                'title': task.title,
                'description': task.description,
                'status': task.status,
                'priority': task.priority,
                'due_date': task.due_date.strftime('%Y-%m-%d') if task.due_date else None,
                'due_date_display': task.due_date.strftime('%b %d') if task.due_date else 'No deadline',
                'assigned_to': {
                    'id': task.assigned_to.id if task.assigned_to else None,
                    'name': task.assigned_to.get_full_name() if task.assigned_to else None,
                    'username': task.assigned_to.username if task.assigned_to else None,
                    'initial': task.assigned_to.first_name[0].upper() if task.assigned_to and task.assigned_to.first_name else '?'
                } if task.assigned_to else None,
                'created_at': task.created_at.strftime('%Y-%m-%d %H:%M'),
                'updated_at': task.updated_at.strftime('%Y-%m-%d %H:%M'),
            }
        
        def get_inprogress_tasks(tasks):
            # Try different possible status values
            return tasks.filter(
                status__in=['inprogress', 'pending', 'in_progress']
            )

        tasks_by_status = {
            'todo': [format_task_for_kanban(task) for task in tasks.filter(status='todo')],
            'inprogress': [format_task_for_kanban(task) for task in get_inprogress_tasks(tasks)],
            'review': [format_task_for_kanban(task) for task in tasks.filter(status='review')],
            'done': [format_task_for_kanban(task) for task in tasks.filter(status='done')],
        }
        
        # Prepare team data
        team_data = []
        for member in team_members:
            member_tasks = tasks.filter(assigned_to=member)
            team_data.append({
                'id': member.id,
                'name': member.get_full_name() or member.username,
                'username': member.username,
                'email': member.email,
                'initial': member.first_name[0].upper() if member.first_name else member.username[0].upper(),
                'task_count': member_tasks.count(),
                'completed_tasks': member_tasks.filter(status_in=status_mapping['done']).count(),
                'is_owner': member.id == project.owner.id,
            })
        
        # Prepare activity data
        activity_data = []
        for task in recent_activity:
            activity_data.append({
                'id': task.id,
                'title': task.title,
                'action': 'updated' if task.updated_at > task.created_at else 'created',
                'user': task.assigned_to.username if task.assigned_to else 'System',
                'user_initial': task.assigned_to.first_name[0].upper() if task.assigned_to and task.assigned_to.first_name else 'S',
                'timestamp': task.updated_at.strftime('%Y-%m-%d %H:%M'),
                'status': task.status,
                'status_display': task.get_status_display(),
            })
        
        return JsonResponse({
            'success': True,
            'project': {
                'id': project.id,
                'name': project.name,
                'description': project.description,
                'owner': {
                    'id': project.owner.id,
                    'name': project.owner.get_full_name() or project.owner.username,
                    'username': project.owner.username,
                    'email': project.owner.email,
                },
                'created_at': project.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                'updated_at': project.updated_at.strftime('%Y-%m-%d %H:%M:%S'),
                'member_count': team_members.count(),
            },
            'stats': {
                'total_tasks': total_tasks,
                'completed_tasks': completed_tasks,
                'overdue_tasks': overdue_tasks,
                'progress': progress,
            },
            'tasks': tasks_by_status,
            'team': team_data,
            'activity': activity_data,
        })
        
    except Exception as e:
        print(f"❌ Error in project_details view: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': f'Server error: {str(e)}'
        }, status=500)

# Add this function to update task status
@csrf_exempt
@require_POST
@login_required
def update_task_status(request):
    try:
        data = json.loads(request.body)
        task_id = data.get('task_id')
        new_status = data.get('status')
        
        if not task_id or not new_status:
            return JsonResponse({'success': False, 'error': 'Missing task_id or status'}, status=400)
        
        task = get_object_or_404(Task, id=task_id)
        
        # Check if user has access to this task's project
        if task.project.owner != request.user and request.user not in task.project.members.all():
            return JsonResponse({'success': False, 'error': 'Access denied'}, status=403)
        
        # Validate status
        valid_statuses = ['todo', 'inprogress', 'review', 'done']
        if new_status not in valid_statuses:
            return JsonResponse({'success': False, 'error': 'Invalid status'}, status=400)
        
        # Update task status
        task.status = new_status
        task.save()
        
        # Recalculate project progress
        project_tasks = Task.objects.filter(project=task.project)
        total_tasks = project_tasks.count()
        completed_tasks = project_tasks.filter(status='done').count()
        progress = int((completed_tasks / total_tasks * 100)) if total_tasks > 0 else 0
        
        return JsonResponse({
            'success': True,
            'message': 'Task status updated successfully',
            'task': {
                'id': task.id,
                'status': task.status,
                'status_display': task.get_status_display(),
            },
            'project_stats': {
                'total_tasks': total_tasks,
                'completed_tasks': completed_tasks,
                'progress': progress,
            }
        })
        
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

# Add this function to get all projects
@login_required
def get_all_projects(request):
    projects = Project.objects.filter(Q(owner=request.user) | Q(members=request.user)).distinct()
    
    projects_data = []
    for project in projects:
        tasks = Task.objects.filter(project=project)
        total_tasks = tasks.count()
        completed_tasks = tasks.filter(status='done').count()
        progress = int((completed_tasks / total_tasks * 100)) if total_tasks > 0 else 0
        
        projects_data.append({
            'id': project.id,
            'name': project.name,
            'description': project.description[:100] + '...' if len(project.description) > 100 else project.description,
            'owner': project.owner.get_full_name() or project.owner.username,
            'created_at': project.created_at.strftime('%Y-%m-%d'),
            'member_count': project.members.count(),
            'task_count': total_tasks,
            'completed_tasks': completed_tasks,
            'progress': progress,
            'is_owner': project.owner == request.user,
        })
    
    return JsonResponse({
        'success': True,
        'projects': projects_data,
        'total_projects': len(projects_data),
    })

from django.http import JsonResponse
from django.views.decorators.http import require_GET
from django.contrib.auth.decorators import login_required

@require_GET
@login_required
def project_members(request, project_id):
    try:
        project = get_object_or_404(Project, id=project_id)
        
        # Check if user has access to this project
        if project.owner != request.user and request.user not in project.members.all():
            return JsonResponse({'success': False, 'error': 'Access denied'}, status=403)
        
        # Get project members
        members = project.members.all()
        
        # Format member data
        members_data = []
        for member in members:
            members_data.append({
                'id': member.id,
                'username': member.username,
                'first_name': member.first_name or '',
                'last_name': member.last_name or '',
                'email': member.email,
                'full_name': member.get_full_name() or member.username,
                'is_owner': member.id == project.owner.id,
            })
        
        return JsonResponse({
            'success': True,
            'project_id': project_id,
            'members': members_data,
            'count': len(members_data)
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@require_GET
@login_required
def dashboard_counts(request):
    """Get updated counts for dashboard without reloading"""
    try:
        # Get user's projects and tasks
        projects = Project.objects.filter(Q(owner=request.user) | Q(members=request.user)).distinct()
        tasks = Task.objects.filter(project__in=projects)
        
        # Calculate counts
        active_projects_count = projects.count()
        tasks_due_count = tasks.exclude(status='done').count()
        overdue_count = tasks.filter(
            due_date__lt=timezone.now().date(),
            status__in=['todo', 'inprogress', 'review']
        ).count()
        
        # Team count (unique users across all projects)
        team_count = User.objects.filter(
            Q(project_owner__in=projects) | Q(project_member__in=projects)
        ).distinct().count()
        
        return JsonResponse({
            'success': True,
            'counts': {
                'active_projects': active_projects_count,
                'tasks_due': tasks_due_count,
                'overdue': overdue_count,
                'team_count': team_count,
            }
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

from django.views.decorators.http import require_GET
from django.http import JsonResponse
from django.utils import timezone
from django.db.models import Q
from projects.models import Project
from tasks.models import Task
from django.contrib.auth.models import User
import json

@require_GET
@login_required
def dashboard_full_data(request):
    """Get complete dashboard data for auto-refresh"""
    try:
        # Get ALL user's projects first
        all_user_projects = Project.objects.filter(
            Q(owner=request.user) | Q(members=request.user)
        ).distinct()
        
        # Get all tasks for ALL user projects
        all_tasks = Task.objects.filter(project__in=all_user_projects)
        
        # Now get only 4 projects for pinned section
        pinned_projects = all_user_projects[:4]
        
        # Calculate counts based on ALL projects, not just pinned
        total_projects_count = all_user_projects.count()
        active_projects_count = all_user_projects.count()
        tasks_due_count = all_tasks.exclude(status='done').count()
        overdue_count = all_tasks.filter(
            due_date__lt=timezone.now().date(),
            status__in=['todo', 'inprogress', 'review']
        ).count()
        team_count = User.objects.filter(
            Q(project_owner__in=all_user_projects) | Q(project_member__in=all_user_projects)
        ).distinct().count()
        
        # Get today's date
        today = timezone.now().date()
        
        # Prepare projects data for pinned section (only 4 projects)
        projects_data = []
        for project in pinned_projects:
            total_tasks = Task.objects.filter(project=project).count()
            completed_tasks = Task.objects.filter(project=project, status='done').count()
            
            if total_tasks > 0:
                progress = int((completed_tasks / total_tasks) * 100)
            else:
                progress = 0
            
            # Add CSS class based on progress
            css_class = ''
            if progress < 50:
                css_class = 'urgent'
            elif progress < 90:
                css_class = 'warning'
            
            projects_data.append({
                'id': project.id,
                'name': project.name,
                'progress': progress,
                'task_count': total_tasks,
                'css_class': css_class,
                'description': project.description or '',
                'created_at': project.created_at.strftime('%Y-%m-%d')
            })
        
        # Prepare task data
        def format_task(task):
            return {
                'id': task.id,
                'title': task.title,
                'status': task.status,
                'project_id': task.project.id,
                'project_name': task.project.name,
                'assigned_to': task.assigned_to.id if task.assigned_to else None,
                'assigned_to_name': task.assigned_to.get_full_name() if task.assigned_to else None,
                'due_date': task.due_date.strftime('%Y-%m-%d') if task.due_date else None,
                'priority': task.priority,
            }
        
        # Get tasks for different sections (from ALL tasks)
        todo_tasks = [format_task(task) for task in all_tasks.filter(status='todo')[:5]]
        inprogress_tasks = [format_task(task) for task in all_tasks.filter(status='inprogress')[:5]]
        review_tasks = [format_task(task) for task in all_tasks.filter(status='review')[:5]]
        done_tasks = [format_task(task) for task in all_tasks.filter(status='done')[:5]]
        
        return JsonResponse({
            'success': True,
            'counts': {
                'active_projects': active_projects_count,
                'tasks_due': tasks_due_count,
                'overdue': overdue_count,
                'team_count': team_count
            },
            'projects': projects_data,  # Only 4 projects for pinned section
            'total_projects': total_projects_count,  # Total count of ALL projects
            'tasks': {
                'todo': todo_tasks,
                'inprogress': inprogress_tasks,
                'review': review_tasks,
                'done': done_tasks
            }
        })
        
    except Exception as e:
        print(f"❌ Error in dashboard_full_data: {str(e)}")
        import traceback
        traceback.print_exc()
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

# home/views.py - Add this view
from django.db.models import Count

@login_required
def cleanup_duplicate_projects(request):
    """Clean up duplicate projects for the current user"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Method not allowed'}, status=405)
    
    try:
        # Get all projects owned by the user
        user_projects = Project.objects.filter(owner=request.user)
        
        # Find duplicates by name
        duplicates = user_projects.values('name').annotate(
            count=Count('id')
        ).filter(count__gt=1)
        
        deleted_count = 0
        kept_projects = []
        
        for duplicate in duplicates:
            # Get all projects with this name
            projects_with_same_name = user_projects.filter(
                name=duplicate['name']
            ).order_by('created_at')
            
            # Keep the oldest one, delete the rest
            for i, project in enumerate(projects_with_same_name):
                if i == 0:
                    # Keep the first (oldest) project
                    kept_projects.append(project.id)
                else:
                    # Delete duplicate
                    project.delete()
                    deleted_count += 1
        
        return JsonResponse({
            'success': True,
            'message': f'Cleaned up {deleted_count} duplicate projects',
            'deleted_count': deleted_count,
            'kept_projects': kept_projects
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

# home/views.py - Add this view

from django.views.decorators.http import require_GET

@require_GET
@login_required
def check_duplicate_project(request):
    """Check if user already has a project with this name"""
    project_name = request.GET.get('name', '').strip()
    
    if not project_name:
        return JsonResponse({'exists': False})
    
    # Check for existing project (case-insensitive)
    existing_project = Project.objects.filter(
        name__iexact=project_name,
        owner=request.user
    ).first()
    
    if existing_project:
        return JsonResponse({
            'exists': True,
            'project_id': existing_project.id,
            'project_name': existing_project.name,
            'created_at': existing_project.created_at.strftime('%Y-%m-%d %H:%M'),
            'message': f'You already have a project named "{existing_project.name}"'
        })
    
    return JsonResponse({'exists': False})

# Add to home/views.py
from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_POST
from django.views.decorators.csrf import csrf_exempt
import json
from tasks.models import Task
from django.contrib.auth.models import User
from django.utils import timezone

# Add this view for getting task details
@require_GET
@login_required
def task_details(request, task_id):
    try:
        task = get_object_or_404(Task, id=task_id)
        
        # Check if user has access to this task's project
        if task.project.owner != request.user and request.user not in task.project.members.all():
            return JsonResponse({'success': False, 'error': 'Access denied'}, status=403)
        
        # Format task data
        task_data = {
            'id': task.id,
            'title': task.title,
            'description': task.description,
            'status': task.status,
            'status_display': task.get_status_display(),
            'priority': task.priority,
            'priority_display': task.get_priority_display(),
            'due_date': task.due_date.strftime('%Y-%m-%d') if task.due_date else None,
            'due_date_formatted': task.due_date.strftime('%b %d, %Y') if task.due_date else 'No deadline',
            'created_at': task.created_at.strftime('%Y-%m-%d %H:%M'),
            'updated_at': task.updated_at.strftime('%Y-%m-%d %H:%M'),
            'project': {
                'id': task.project.id,
                'name': task.project.name,
                'owner_id': task.project.owner.id,
            },
            'assigned_to': {
                'id': task.assigned_to.id if task.assigned_to else None,
                'username': task.assigned_to.username if task.assigned_to else None,
                'first_name': task.assigned_to.first_name if task.assigned_to else None,
                'last_name': task.assigned_to.last_name if task.assigned_to else None,
                'full_name': task.assigned_to.get_full_name() if task.assigned_to else None,
                'initial': task.assigned_to.first_name[0].upper() if task.assigned_to and task.assigned_to.first_name else 
                          task.assigned_to.username[0].upper() if task.assigned_to else '?',
            } if task.assigned_to else None,
            'created_by': {
                'id': task.project.owner.id,
                'username': task.project.owner.username,
                'full_name': task.project.owner.get_full_name(),
                'initial': task.project.owner.first_name[0].upper() if task.project.owner.first_name else 
                          task.project.owner.username[0].upper(),
            },
            'is_overdue': task.due_date and task.due_date < timezone.now().date() and task.status != 'done',
            'days_left': (task.due_date - timezone.now().date()).days if task.due_date else None,
        }
        
        return JsonResponse({
            'success': True,
            'task': task_data
        })
        
    except Exception as e:
        print(f"❌ Error in task_details view: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': f'Server error: {str(e)}'
        }, status=500)

# Add this view for updating task details
@csrf_exempt
@require_POST
@login_required
def update_task_api(request, task_id):
    try:
        task = get_object_or_404(Task, id=task_id)
        
        # Check if user has access to this task's project
        if task.project.owner != request.user and request.user not in task.project.members.all():
            return JsonResponse({'success': False, 'error': 'Access denied'}, status=403)
        
        data = json.loads(request.body.decode('utf-8'))
        
        # Update task fields if provided
        if 'title' in data:
            task.title = data['title']
        
        if 'description' in data:
            task.description = data['description']
        
        if 'status' in data and data['status'] in ['todo', 'inprogress', 'review', 'done']:
            task.status = data['status']
        
        if 'priority' in data and data['priority'] in ['low', 'medium', 'high', 'urgent']:
            task.priority = data['priority']
        
        if 'due_date' in data:
            if data['due_date']:
                try:
                    task.due_date = datetime.strptime(data['due_date'], '%Y-%m-%d').date()
                except ValueError:
                    return JsonResponse({'success': False, 'error': 'Invalid date format'}, status=400)
            else:
                task.due_date = None
        
        if 'assigned_to' in data:
            if data['assigned_to']:
                try:
                    assigned_user = User.objects.get(id=data['assigned_to'])
                    task.assigned_to = assigned_user
                except User.DoesNotExist:
                    return JsonResponse({'success': False, 'error': 'User not found'}, status=404)
            else:
                task.assigned_to = None
        
        task.save()
        
        # Format updated task data
        task_data = {
            'id': task.id,
            'title': task.title,
            'description': task.description,
            'status': task.status,
            'priority': task.priority,
            'due_date': task.due_date.strftime('%Y-%m-%d') if task.due_date else None,
            'assigned_to': task.assigned_to.id if task.assigned_to else None,
            'updated_at': task.updated_at.strftime('%Y-%m-%d %H:%M'),
        }
        
        return JsonResponse({
            'success': True,
            'message': 'Task updated successfully',
            'task': task_data
        })
        
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        print(f"❌ Error in update_task_api: {str(e)}")
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

# If you have a comments app, add this for comments
# If not, create a simple Comment model in tasks/models.py# Add to home/views.py
from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_POST
from django.views.decorators.csrf import csrf_exempt
import json
from tasks.models import Task
from django.contrib.auth.models import User
from django.utils import timezone

# Add this view for getting task details
@require_GET
@login_required
def task_details(request, task_id):
    try:
        task = get_object_or_404(Task, id=task_id)
        
        # Check if user has access to this task's project
        if task.project.owner != request.user and request.user not in task.project.members.all():
            return JsonResponse({'success': False, 'error': 'Access denied'}, status=403)
        
        # Format task data
        task_data = {
            'id': task.id,
            'title': task.title,
            'description': task.description,
            'status': task.status,
            'status_display': task.get_status_display(),
            'priority': task.priority,
            'priority_display': task.get_priority_display(),
            'due_date': task.due_date.strftime('%Y-%m-%d') if task.due_date else None,
            'due_date_formatted': task.due_date.strftime('%b %d, %Y') if task.due_date else 'No deadline',
            'created_at': task.created_at.strftime('%Y-%m-%d %H:%M'),
            'updated_at': task.updated_at.strftime('%Y-%m-%d %H:%M'),
            'project': {
                'id': task.project.id,
                'name': task.project.name,
                'owner_id': task.project.owner.id,
            },
            'assigned_to': {
                'id': task.assigned_to.id if task.assigned_to else None,
                'username': task.assigned_to.username if task.assigned_to else None,
                'first_name': task.assigned_to.first_name if task.assigned_to else None,
                'last_name': task.assigned_to.last_name if task.assigned_to else None,
                'full_name': task.assigned_to.get_full_name() if task.assigned_to else None,
                'initial': task.assigned_to.first_name[0].upper() if task.assigned_to and task.assigned_to.first_name else 
                          task.assigned_to.username[0].upper() if task.assigned_to else '?',
            } if task.assigned_to else None,
            'created_by': {
                'id': task.project.owner.id,
                'username': task.project.owner.username,
                'full_name': task.project.owner.get_full_name(),
                'initial': task.project.owner.first_name[0].upper() if task.project.owner.first_name else 
                          task.project.owner.username[0].upper(),
            },
            'is_overdue': task.due_date and task.due_date < timezone.now().date() and task.status != 'done',
            'days_left': (task.due_date - timezone.now().date()).days if task.due_date else None,
        }
        
        return JsonResponse({
            'success': True,
            'task': task_data
        })
        
    except Exception as e:
        print(f"❌ Error in task_details view: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': f'Server error: {str(e)}'
        }, status=500)

# Add this view for updating task details
@csrf_exempt
@require_POST
@login_required
def update_task_api(request, task_id):
    try:
        task = get_object_or_404(Task, id=task_id)
        
        # Check if user has access to this task's project
        if task.project.owner != request.user and request.user not in task.project.members.all():
            return JsonResponse({'success': False, 'error': 'Access denied'}, status=403)
        
        data = json.loads(request.body.decode('utf-8'))
        
        # Update task fields if provided
        if 'title' in data:
            task.title = data['title']
        
        if 'description' in data:
            task.description = data['description']
        
        if 'status' in data and data['status'] in ['todo', 'inprogress', 'review', 'done']:
            task.status = data['status']
        
        if 'priority' in data and data['priority'] in ['low', 'medium', 'high', 'urgent']:
            task.priority = data['priority']
        
        if 'due_date' in data:
            if data['due_date']:
                try:
                    task.due_date = datetime.strptime(data['due_date'], '%Y-%m-%d').date()
                except ValueError:
                    return JsonResponse({'success': False, 'error': 'Invalid date format'}, status=400)
            else:
                task.due_date = None
        
        if 'assigned_to' in data:
            if data['assigned_to']:
                try:
                    assigned_user = User.objects.get(id=data['assigned_to'])
                    task.assigned_to = assigned_user
                except User.DoesNotExist:
                    return JsonResponse({'success': False, 'error': 'User not found'}, status=404)
            else:
                task.assigned_to = None
        
        task.save()
        
        # Format updated task data
        task_data = {
            'id': task.id,
            'title': task.title,
            'description': task.description,
            'status': task.status,
            'priority': task.priority,
            'due_date': task.due_date.strftime('%Y-%m-%d') if task.due_date else None,
            'assigned_to': task.assigned_to.id if task.assigned_to else None,
            'updated_at': task.updated_at.strftime('%Y-%m-%d %H:%M'),
        }
        
        return JsonResponse({
            'success': True,
            'message': 'Task updated successfully',
            'task': task_data
        })
        
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        print(f"❌ Error in update_task_api: {str(e)}")
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

# If you have a comments app, add this for comments
# If not, create a simple Comment model in tasks/models.py

# Add to home/views.py
from comments.models import Comment  # Import if you created the Comment model

@require_GET
@login_required
def task_comments(request, task_id):
    try:
        task = get_object_or_404(Task, id=task_id)
        
        # Check if user has access to this task's project
        if task.project.owner != request.user and request.user not in task.project.members.all():
            return JsonResponse({'success': False, 'error': 'Access denied'}, status=403)
        
        # Get comments for this task
        comments = Comment.objects.filter(task=task).order_by('-created_at')
        
        comments_data = []
        for comment in comments:
            comments_data.append({
                'id': comment.id,
                'content': comment.content,
                'user': {
                    'id': comment.user.id,
                    'username': comment.user.username,
                    'first_name': comment.user.first_name,
                    'last_name': comment.user.last_name,
                    'full_name': comment.user.get_full_name() or comment.user.username,
                    'initial': comment.user.first_name[0].upper() if comment.user.first_name else comment.user.username[0].upper(),
                },
                'created_at': comment.created_at.strftime('%Y-%m-%d %H:%M'),
                'updated_at': comment.updated_at.strftime('%Y-%m-%d %H:%M'),
                'is_editable': comment.user == request.user,
            })
        
        return JsonResponse({
            'success': True,
            'comments': comments_data,
            'count': len(comments_data)
        })
        
    except Exception as e:
        print(f"❌ Error in task_comments view: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': f'Server error: {str(e)}'
        }, status=500)

@csrf_exempt
@require_POST
@login_required
def add_comment_api(request, task_id):
    try:
        task = get_object_or_404(Task, id=task_id)
        
        # Check if user has access to this task's project
        if task.project.owner != request.user and request.user not in task.project.members.all():
            return JsonResponse({'success': False, 'error': 'Access denied'}, status=403)
        
        data = json.loads(request.body.decode('utf-8'))
        
        if not data.get('content'):
            return JsonResponse({'success': False, 'error': 'Comment content is required'}, status=400)
        
        # Create comment
        comment = Comment(
            task=task,
            user=request.user,
            content=data['content']
        )
        comment.save()
        
        # Return created comment
        comment_data = {
            'id': comment.id,
            'content': comment.content,
            'user': {
                'id': comment.user.id,
                'username': comment.user.username,
                'first_name': comment.user.first_name,
                'last_name': comment.user.last_name,
                'full_name': comment.user.get_full_name() or comment.user.username,
                'initial': comment.user.first_name[0].upper() if comment.user.first_name else comment.user.username[0].upper(),
            },
            'created_at': comment.created_at.strftime('%Y-%m-%d %H:%M'),
            'updated_at': comment.updated_at.strftime('%Y-%m-%d %H:%M'),
            'is_editable': True,  # User can edit their own comment
        }
        
        return JsonResponse({
            'success': True,
            'message': 'Comment added successfully',
            'comment': comment_data
        })
        
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        print(f"❌ Error in add_comment_api: {str(e)}")
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

# home/views.py - Add task deletion endpoint
@csrf_exempt
@require_POST
@login_required
def delete_task_api(request, task_id):
    try:
        task = get_object_or_404(Task, id=task_id)
        
        # Check if user has access to this task's project
        if task.project.owner != request.user and request.user not in task.project.members.all():
            return JsonResponse({'success': False, 'error': 'Access denied'}, status=403)
        
        # Store task info before deletion for response
        task_info = {
            'id': task.id,
            'title': task.title,
            'project_id': task.project.id,
            'project_name': task.project.name
        }
        
        # Delete the task
        task.delete()
        
        return JsonResponse({
            'success': True,
            'message': 'Task deleted successfully',
            'deleted_task': task_info
        })
        
    except Exception as e:
        print(f"❌ Error deleting task: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)