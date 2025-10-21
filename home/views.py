from django.shortcuts import render

# Create your views here.

def landing(request):
    template_data = {}
    template_data['title'] = 'Project Tracker'
    return render(request, 'home/landing_page.html', {'template_data': template_data})