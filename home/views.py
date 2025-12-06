from django.shortcuts import render

# Create your views here.

def landing(request):
    template_data = {}
    template_data['title'] = 'Get Started | Project Tracker'
    return render(request, 'home/landing_page.html', {'template_data': template_data})


def handler404(request, exception):
    return render(request, 'core/404.html', status=404)