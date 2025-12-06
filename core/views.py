from django.shortcuts import render, redirect

# Create your views here.



def index(request):
    return redirect('dashboard:index')

def handler404(request, exception):
    return render(request, 'core/404.html', status=404)