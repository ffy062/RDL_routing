import numpy as np

arr_1 = np.empty([5, 4, 2])
arr_2 = np.array
arr_1.fill(0)
with open("ddd.txt", 'r',encoding="utf-8") as f :
    ll = f.readlines()
for line in ll :
    n_line = line.split()
    del n_line[0]
    #print(int(n_line[1]))
    #arr_1[int(n_line[0])][int(n_line[1])][int(n_line[2])] = int(n_line[3])
#print(arr_1)
o_f = open('dis.txt', 'w')
for dis in arr_1 :
    print(dis)
f.close()