
const STORAGE="chore_v6"

let state=load()

function load(){
let d=localStorage.getItem(STORAGE)
if(d)return JSON.parse(d)

let seed={
groups:[
{name:"Kitchen",chores:["Dishes","Trash","Counters"]},
{name:"Bathroom",chores:["Toilet","Sink","Mirror"]},
{name:"Bedroom",chores:["Make Bed","Trash","Vacuum"]}
],
logs:[]
}

save(seed)
return seed
}

function save(s=state){
localStorage.setItem(STORAGE,JSON.stringify(s))
}

function toast(t){
let el=document.getElementById("toast")
el.innerText=t
el.classList.add("show")
setTimeout(()=>el.classList.remove("show"),1600)
}

function tab(t){
document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab==t))
document.querySelectorAll(".panel").forEach(p=>p.classList.toggle("active",p.id==t))
}

document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>tab(b.dataset.tab))

function renderHome(){
let wrap=document.getElementById("groupList")
wrap.innerHTML=""
state.groups.forEach((g,i)=>{
let el=document.createElement("div")
el.className="group"
el.innerText=g.name
el.onclick=()=>openGroup(i)
wrap.appendChild(el)
})
}

let currentGroup=null

function openGroup(i){
currentGroup=i
tab("group")
let g=state.groups[i]
document.getElementById("groupTitle").innerText=g.name
let wrap=document.getElementById("choreList")
wrap.innerHTML=""

g.chores.forEach((c,ci)=>{

let card=document.createElement("div")
card.className="chore"

card.innerHTML=`
<div class="swipe-bg swipe-plus">+<span></span></div>
<div class="swipe-bg swipe-minus"><span></span>-</div>
<div class="chore-content">${c}</div>
`

addSwipe(card,()=>log(ci,"plus"),()=>log(ci,"minus"))

wrap.appendChild(card)

})

}

document.getElementById("backBtn").onclick=()=>tab("home")

function log(ci,type){
let g=state.groups[currentGroup]
state.logs.unshift({
group:g.name,
chore:g.chores[ci],
type,
time:new Date().toLocaleString()
})
save()
toast(`Logged ${g.chores[ci]} ${type=="plus"?"+":"-"}`)
renderLog()
}

function renderLog(){
let wrap=document.getElementById("logList")
wrap.innerHTML=""
state.logs.forEach(l=>{
let el=document.createElement("div")
el.className="group"
el.innerText=`${l.group} / ${l.chore} ${l.type=="plus"?"+":"-"}  •  ${l.time}`
wrap.appendChild(el)
})
}

function addSwipe(el,onRight,onLeft){

let startX=0
let currentX=0
let active=false

el.addEventListener("touchstart",e=>{
startX=e.touches[0].clientX
active=true
})

el.addEventListener("touchmove",e=>{
if(!active)return
currentX=e.touches[0].clientX-startX
el.style.transform=`translateX(${currentX}px)`
})

el.addEventListener("touchend",()=>{
active=false

if(currentX>80){
onRight()
}
else if(currentX<-80){
onLeft()
}

el.style.transition="0.2s"
el.style.transform="translateX(0)"

setTimeout(()=>el.style.transition="",200)

currentX=0
})

}

renderHome()
renderLog()
