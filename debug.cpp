#include <iostream>
#include <fstream>
#include <string>

using namespace std;

int main() {
    ifstream in_f("ddd.txt");
    ofstream out_f("dis.txt");
    int dis_arr[200][200][2];
    string ll;
    while(getline(in_f, ll)) {
        cout << ll << '\n';
        int len = ll.length(), i = 0;
        for(i = 0; i < len; ++i) {
            if(ll[i] == ' ') {
                break;
            }
        }
        
    }
    in_f.close();

    return 0;
}