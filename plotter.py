import matplotlib
matplotlib.use('agg')
from matplotlib.colors import LogNorm
import matplotlib.pyplot as plt
import json

with open('data.json', 'r') as f:
    plot_data = json.load(f)

x_data = plot_data[0]
y_data = plot_data[1]
#for m in plot_data:
#    x_data.append(m['score'])
#    y_data.append(m['viewers'])

plt.ioff()
#plt.scatter(x_data, y_data, alpha=0.3)
plt.plot(x_data, y_data, 'ro')
plt.xlabel('score')
plt.ylabel('viewers')

plt.savefig('data_chart.png')
plt.show()
