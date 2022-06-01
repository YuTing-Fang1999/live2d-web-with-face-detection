

import cv2
import numpy as np
from utils import separateEdge, combine
from style_lib import happy_effect, angry_effect, suprise_effect, art_effect

def apply_motion_blur(image, size, angle):
    k = np.zeros((size, size), dtype=np.float32)
    k[ (size-1)// 2 , :] = np.ones(size, dtype=np.float32)
    k = cv2.warpAffine(k, cv2.getRotationMatrix2D( (size / 2 -0.5 , size / 2 -0.5 ) , angle, 1.0), (size, size) )  
    k = k * ( 1.0 / np.sum(k) )        
    return cv2.filter2D(image, -1, k)


def stylize(img, mode="oil_painting"):
    res = img.copy()
    # print(res.shape)
    if mode=="surprise":
        res = suprise_effect(res)
    elif mode=="happy":
        res = happy_effect(res)
    elif mode=="close":
        res = art_effect(res)
    # else:
    #     res = paint(img_rgb, [520, 260, 130], 20) # 60~70 8 4 2
    
    return res

def main(filename, style, debug=False):

    if style=="Surprise" or style=="Happy" or style=="Angry":
        img = cv2.imread(filename, cv2.IMREAD_UNCHANGED)

        if style=="Happy":          img_stylized = happy_effect(img)
        elif style=="Angry":        img_stylized = angry_effect(img)
        elif style=="Surprise":     img_stylized = suprise_effect(img)
        
        # img_stylized = stylize(img, mode=style)
        img_stylized[:,:,3] = img[:,:,3]
    elif style=="CloseEyes":

        img = cv2.imread(filename, cv2.IMREAD_UNCHANGED)
        img_nonEdge, img_edge = separateEdge(img)
        cv2.imwrite("./close_nonEdge.png", img_nonEdge)
        cv2.imwrite("./close_Edge.png", img_edge)
        stylized_nonEdge = art_effect(img_nonEdge)
        # stylized_nonEdge = stylize(img_nonEdge, mode=style)
        img_stylized = combine(img_edge, stylized_nonEdge)
        img_stylized[:,:,3] = img[:,:,3]
    
    return img_stylized

if __name__ == "__main__":

    import argparse
    configs = {
        "Happy":
        {
            "input": ["./input/Haru_00.png", "./input/Haru_01.png"], 
            "output":["./texture_02.png", "./texture_03.png"],
            "back_output":"./back1.png",
        },
        "Angry":
        {
            "input": ["./input/Haru_00.png", "./input/Haru_01.png"], 
            "output":["./texture_04.png", "./texture_05.png"],
            "back_output":"./back2.png",
        },
        "Surprise":
        {
            "input": ["./input/Haru_00.png", "./input/Haru_01.png"], 
            "output":["./texture_06.png", "./texture_07.png"],
            "back_output":"./back3.png",
        },
        "CloseEyes":
        {
            "input": ["./input/Haru_00.png", "./input/Haru_01.png"], 
            "output":["./texture_08.png", "./texture_09.png"],
            "back_output":"./back4.png",
        }
    }
    # python main.py -i ./input/Haru_01.png -o ./texture01.png -ei 3 -ep -1 -s oil_painting
    parser = argparse.ArgumentParser(description='')
    parser.add_argument('--style', '-s', type=str, default="close", help='')
    parser.add_argument('--debug', '-d', type=bool, default=False, help='')
    args = parser.parse_args()


    
    config = configs[args.style]

    for i, filename in enumerate(config["input"]):

        res = main( filename=filename, \
                    style=args.style,
                    debug=args.debug
                    )
        cv2.imwrite(config["output"][i], res)

    back_img = cv2.imread("./input/back0.png")

    if args.style=="Happy":
        pass
    elif args.style=="Angry":
        pass
    elif args.style=="Surprise":
        pass
    elif args.style=="CloseEyes":
        pass