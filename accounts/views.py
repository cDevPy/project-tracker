from django.shortcuts import render, redirect
# from django.contrib.auth.decorators import login_required
from django.contrib.auth import login, authenticate, logout
from .forms import CustomUserCreationForm, CustomErrorList

# Create your views here.

def access(request):
    template_data = {}
    template_data['title'] = 'Account Access | Project Tracker'
    return render(request, 'accounts/access.html', {'template_data': template_data})

def signup(request):
    template_data = {}
    template_data['title'] = 'Sign Up | Project Tracker'
    
    if request.method == 'GET':
        template_data['form'] = CustomUserCreationForm()
        return render(request, 'accounts/signup.html', {'template_data': template_data})
    
    elif request.method == 'POST':
        form = CustomUserCreationForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            return redirect('projects:index')
            
        else:
            template_data['form'] = form
            return render(request, 'accounts/signup.html', {'template_data': template_data})

def userLogin(request):
    template_data = {}
    template_data['title'] = 'Login | Project Tracker'
    if request.method == 'GET':
        return render(request, 'accounts/login.html', {"template_data": template_data})
    elif request.method == 'POST':
        user = authenticate(request, username = request.POST['username'], password = request.POST['password'])
        if user is not None:
            login(request, user)
            return redirect('projects:index') 
        else:
            template_data['error'] = 'The username or password is incorrect'
            return render(request, 'accounts/login.html', {'template_data': template_data})

def userLogout(request):
    logout(request)
    return redirect('home.landing')