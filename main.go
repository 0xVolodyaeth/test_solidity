package main

import (
	"context"
	"fmt"
	"sync"
	"time"
)

func main() {

	// r.HandleFunc("/debug/pprof/", pprof.Index)
	// r.HandleFunc("/debug/pprof/cmdline", pprof.Cmdline)
	// r.HandleFunc("/debug/pprof/profile", pprof.Profile)
	// r.HandleFunc("/debug/pprof/symbol", pprof.Symbol)
	// r.HandleFunc("/debug/pprof/trace", pprof.Trace)

	quer := "some"
	// l := []searchFunc{sear, sear, sear, sear}
	l := []searchFunc{sear, sear, searThatWorks, sear}
	// l := []searchFunc{sear, sear, searLong, sear}

	ctx := context.Background()
	res, err := SearchEverhing(ctx, quer, l)

	if err != nil {
		fmt.Println("error from searchEverything: ", err)
		return
	}

	fmt.Println(res)
}

type Result struct{}

type searchFunc func(ctx context.Context, query string) (*Result, error)

func searThatWorks(ctx context.Context, query string) (*Result, error) {
	time.Sleep(time.Second * 3)
	return &Result{}, nil
}

func searLong(ctx context.Context, query string) (*Result, error) {
	time.Sleep(time.Second * 4)
	return nil, fmt.Errorf("err")
}
func sear(ctx context.Context, query string) (*Result, error) {
	time.Sleep(time.Second * 2)
	return nil, fmt.Errorf("err")
}

func SearchEverhing(ctx context.Context, query string, sfs []searchFunc) (*Result, error) {
	errChan := make(chan error, len(sfs))
	resChan := make(chan Result)

	cancelFuncsSlice := make([]context.CancelFunc, 0)
	var wg sync.WaitGroup

	for _, sf := range sfs {
		ctxSearch, canel := context.WithCancel(ctx)
		cancelFuncsSlice = append(cancelFuncsSlice, canel)

		wg.Add(1)
		go cuncurrentSearch(ctxSearch, &wg, query, sf, errChan, resChan)
	}

	var resFirst *Result
	var errLast error
	var errCount int = 1

	wg.Add(1)
	go func() {
		defer wg.Done()

		for {
			select {
			case res := <-resChan:

				resFirst = &res
				for _, c := range cancelFuncsSlice {
					c()
				}

				close(errChan)
				close(resChan)
				return

			case err := <-errChan:

				// fmt.Println(errCount, len(sfs))

				if errCount == len(sfs) {
					for _, c := range cancelFuncsSlice {
						c()
					}

					close(errChan)
					close(resChan)
					return
				}

				errLast = err
				errCount++
			}
		}
	}()

	wg.Wait()
	if resFirst == nil {
		return nil, errLast
	}

	return resFirst, nil
}

func cuncurrentSearch(ctx context.Context, wg *sync.WaitGroup, query string, sf searchFunc, errChan chan error, resChan chan Result) {
	defer wg.Done()

	running := false
	for {
		select {
		case <-ctx.Done():
			return

		default:
			if !running {
				running = true

				res, err := sf(ctx, query)
				if err != nil {
					errChan <- err
					return
				}

				resChan <- *res
			}
		}
	}
}
