import numpy as np

arr_1 = np.empty([80, 110])
arr_2 = np.empty([80, 110])
arr_1.fill(0)
arr_2.fill(0)
with open("ddd.txt", 'r',encoding="utf-8") as f :
    ll = f.readlines()
x_min = 1000
x_max = 0
y_min = 1000
y_max = 0
for line in ll :
    n_line = line.split()
    del n_line[0]
    #print(int(n_line[1]))
    x_min = min(x_min, int(n_line[0]))
    x_max = max(x_max, int(n_line[0]))
    y_min = min(y_min, int(n_line[1]))
    y_max = max(y_max, int(n_line[1]))
    if int(n_line[2]) == 0 :
        arr_1[int(n_line[1])][int(n_line[0])-25] = int(n_line[3])
    else :
        arr_2[int(n_line[1])][int(n_line[0])-25] = int(n_line[3])
#print(arr_1)
arr_1[46][87-25] = 66
arr_2[46][87-25] = 65
print(x_min, x_max, y_min, y_max)
o_f1 = open('dis_1.txt', 'w')
o_f2 = open('dis_2.txt', 'w')
for dis in arr_1 :
   # print(dis)
    #print(dis, file = o_f)
    out_1 = np.array2string(dis, 900)
    o_f1.write(out_1)
    o_f1.write('\n')

for dis in arr_2 :
    out_1 = np.array2string(dis, 900)
    o_f2.write(out_1)
    o_f2.write('\n')
o_f1.close()
o_f2.close()