from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.utils import timezone
from .models import Project, Task
from .forms import TaskForm, ProjectForm 
from django.contrib.auth.models import User
from django.contrib import messages
from .forms import InviteForm 
from django.db.models import Q 


@login_required
def index(request):
    # 1. Fetch data for the logged-in user
    projects = Project.objects.filter(owner=request.user)
    tasks = Task.objects.filter(project__in=projects)

    # 2. SEARCH LOGIC (The New Part)
    query = request.GET.get('q')

    if query:
        tasks = tasks.filter(
            Q(title__icontains=query) | 
            Q(project__name__icontains=query)
        )

        projects = projects.filter(
            Q(name__icontains=query) | 
            Q(description__icontains=query)
        )

    # 3. Calculate Counts
    active_projects_count = projects.count()
    tasks_due_count = tasks.exclude(status='done').count()
    overdue_count = tasks.filter(
        due_date__lt=timezone.now().date(), 
        status__in=['todo', 'inprogress', 'review']
    ).count()
    team_count = User.objects.filter(projects_joined__in=projects).distinct().count()
    
    # 4. Categorize Tasks for Kanban Board
    todo_tasks = tasks.filter(status='todo')
    inprogress_tasks = tasks.filter(status='inprogress')
    review_tasks = tasks.filter(status='review')
    done_tasks = tasks.filter(status='done')

    upcoming_deadlines = Task.objects.filter(
        due_date__gte=timezone.now().date(),
        status__in=['todo', 'inprogress', 'review']
    ).order_by('due_date')[:5]

    your_tasks = Task.objects.filter(assignee=request.user).exclude(status='done')[:5]
    recent_activity = tasks.order_by('-id')[:5]

    #Calculate progress for each project
    projects_with_stats = []
    for project in projects:
        total_tasks = Task.objects.filter(project=project).count()
        completed_tasks = Task.objects.filter(project=project, status='done').count()
        
        if total_tasks > 0:
            progress = int((completed_tasks / total_tasks) * 100)
        else:
            progress = 0

        project.progress = progress
        projects_with_stats.append(project)

    context = {
       # 'active_projects_count': active_projects_count,
        #'tasks_due_count': tasks_due_count,
        'overdue_count': overdue_count,
        'team_count': team_count,
        'upcoming_deadlines': upcoming_deadlines,
        
        'todo_tasks': todo_tasks,
        'inprogress_tasks': inprogress_tasks,
        'review_tasks': review_tasks,
        'done_tasks': done_tasks,
        
        'your_tasks': your_tasks,
        'recent_activity': recent_activity,
        'projects': projects_with_stats,
        'active_projects_count': projects.count(),
        'tasks_due_count': tasks.exclude(status='done').count(),
        'user': request.user,
    }
    
    return render(request, 'projects/tasks_list.html', context)

@login_required
def create_task(request):
    # This replaces your old 'create' view
    if request.method == 'POST':
        form = TaskForm(request.POST)
        if form.is_valid():
            task = form.save(commit=False)
            # We don't need to set task.user anymore because the Project handles ownership
            task.save()
            return redirect('projects:index')
    else:
        form = TaskForm()
    
    # We need a simple template for this form (we will check this next)
    return render(request, 'projects/create_task.html', {'form': form})

@login_required
def delete_task(request, id):
    # We use get_object_or_404 for safety
    task = get_object_or_404(Task, id=id)
    
    # Security check: Ensure the task belongs to a project owned by the user
    if task.project.owner == request.user:
        task.delete()
    
    return redirect('projects:index')


@login_required
def create_project(request):
    if request.method == 'POST':
        form = ProjectForm(request.POST)
        if form.is_valid():
            project = form.save(commit=False)
            project.owner = request.user  
            project.save()
            return redirect('projects:index')
    else:
        form = ProjectForm()
    
    return render(request, 'projects/create_project.html', {'form': form})

@login_required
def edit_task(request, id):
    task = get_object_or_404(Task, id=id)
    if task.project.owner != request.user:
        return redirect('projects:index')
    if request.method == 'POST':
        form = TaskForm(request.POST, instance=task)
        if form.is_valid():
            form.save()
            return redirect('projects:index')
    else:
        form = TaskForm(instance=task)

    return render(request, 'projects/edit_task.html', {'form': form})



@login_required
def invite_member(request):
    if request.method == 'POST':
        form = InviteForm(request.POST)
        if form.is_valid():
            username = form.cleaned_data['username']
            try:
                new_member = User.objects.get(username=username)
                project = Project.objects.filter(owner=request.user).first()
                
                if project:
                    project.members.add(new_member)
                    messages.success(request, f"Added {username} to {project.name}!")
                else:
                    messages.error(request, "You don't have any projects to invite people to.")
                    
                return redirect('projects:index')
                
            except User.DoesNotExist:
                messages.error(request, "User does not exist!")
    else:
        form = InviteForm()
    
    return render(request, 'projects/invite.html', {'form': form})

@login_required
def project_hub(request):
    projects = Project.objects.filter(owner=request.user)
    return render(request, 'projects/project_hub.html', {'projects': projects})

@login_required
def project_detail(request, id):
    
    project = get_object_or_404(Project, id=id)
    
    if project.owner != request.user:
        return redirect('projects:index')
        
    
    tasks = Task.objects.filter(project=project)
    
    
    total_tasks = tasks.count()
    done_tasks = tasks.filter(status='done').count()
    progress = int((done_tasks / total_tasks) * 100) if total_tasks > 0 else 0

    context = {
        'project': project,
        'tasks': tasks,
        'progress': progress,
        'todo_count': tasks.filter(status='todo').count(),
        'done_count': done_tasks,
    }
    return render(request, 'projects/project_detail.html', context)

@login_required
def delete_project(request, id):
    project = get_object_or_404(Project, id=id)
    if project.owner == request.user:
        project.delete()
    return redirect('projects:project_hub')